import { GoogleGenAI } from "@google/genai";
import * as z from "zod";

import { getWeekday, toIsoDate } from "@/lib/date";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CASTING_BOARD_BUCKET,
  CastingBoardResult,
  ParsedPerformance,
} from "@/type/casting";
import { ShowDetail } from "@/type/show";

const MODEL = "gemini-3.5-flash-lite";

const castingJsonSchema = {
  type: "object",
  properties: {
    performances: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Performance date in YYYY-MM-DD format.",
          },
          weekday: {
            type: "string",
            description: "Weekday in Korean (월, 화, 수, 목, 금, 토, 일).",
          },
          time: {
            type: "string",
            description: "Performance time in HH:mm format.",
          },
          casting: {
            type: "object",
            description: "Role name -> actor name mapping.",
            additionalProperties: {
              type: "string",
            },
          },
        },
        required: ["date", "weekday", "time", "casting"],
      },
    },
  },
  required: ["performances"],
} satisfies z.core.JSONSchema.JSONSchema;

const castingSchema = z.fromJSONSchema(castingJsonSchema);

const buildPrompt = (show: ShowDetail) => `
Extract the casting schedule table from this image.

The image is a casting board for:
- Title: ${show.prfnm}
- Run: ${toIsoDate(show.prfpdfrom)} ~ ${toIsoDate(show.prfpdto)}

Rules:
- Rows are performances (date and time), columns are roles, cells are actor names.
- The board usually omits the year. Resolve every date using the run above.
- Drop any row whose date falls outside the run.
- A merged cell applies to every row or column it spans.
- Use the role names in the header row as the keys of "casting".
- Omit a cell from "casting" when it is empty or a placeholder such as "-".
- If no casting table exists, return an empty performances array.
- If multiple tables exist, use only the largest and most complete one.
- Make your best guess for ambiguous text, but never invent a performance that is not visible.
`;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const PLACEHOLDER_NAMES = new Set(["", "-", "–", "—", "미정", "n/a", "N/A"]);

const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ");

// Gemini 응답의 값을 보장하기 위해 여기서 한 번 더 거른다
function normalizePerformances(
  performances: ParsedPerformance[],
  show: ShowDetail,
) {
  const from = toIsoDate(show.prfpdfrom);
  const to = toIsoDate(show.prfpdto);

  const seen = new Set<string>();
  const valid: ParsedPerformance[] = [];

  let skippedCount = 0;

  for (const performance of performances) {
    const date = performance.date?.trim() ?? "";
    const time = performance.time?.trim() ?? "";

    const casting = Object.fromEntries(
      Object.entries(performance.casting ?? {})
        .map(([role, actor]) => [normalizeName(role), normalizeName(actor)])
        .filter(
          ([role, actor]) => role && !PLACEHOLDER_NAMES.has(actor.toLowerCase()),
        ),
    );

    const key = `${date} ${time}`;

    const isValid =
      DATE_PATTERN.test(date) &&
      TIME_PATTERN.test(time) &&
      date >= from &&
      date <= to &&
      getWeekday(date) === performance.weekday?.trim() &&
      Object.keys(casting).length > 0 &&
      !seen.has(key);

    if (!isValid) {
      skippedCount += 1;
      continue;
    }

    seen.add(key);
    valid.push({ date, time, weekday: performance.weekday, casting });
  }

  return { performances: valid, skippedCount };
}

export async function parseCastingBoard(image: Blob, show: ShowDetail) {
  const base64Image = Buffer.from(await image.arrayBuffer()).toString("base64");

  const client = new GoogleGenAI({});

  const interaction = await client.interactions.create({
    model: MODEL,
    input: [
      { type: "text", text: buildPrompt(show) },
      {
        type: "image",
        data: base64Image,
        mime_type: image.type || "image/jpeg",
      },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: castingJsonSchema,
    },
  });

  if (!interaction.output_text) {
    throw new Error("Gemini가 응답하지 않았습니다");
  }

  let raw: unknown;

  try {
    raw = JSON.parse(interaction.output_text);
  } catch {
    console.error(interaction.output_text);

    throw new Error("Gemini가 JSON이 아닌 응답을 반환했습니다");
  }

  const parsed = castingSchema.parse(raw) as { performances: ParsedPerformance[] };

  return normalizePerformances(parsed.performances, show);
}

export async function saveCastingBoard({
  showId,
  userId,
  storagePath,
  performances,
  skippedCount,
}: {
  showId: string;
  userId: string;
  storagePath: string;
  performances: ParsedPerformance[];
  skippedCount: number;
}): Promise<CastingBoardResult> {
  const admin = createAdminClient();

  const {
    data: { publicUrl },
  } = admin.storage.from(CASTING_BOARD_BUCKET).getPublicUrl(storagePath);

  const { data: upload, error: uploadError } = await admin
    .from("uploads")
    .insert({ show_id: showId, user_id: userId, url: publicUrl })
    .select("id")
    .single();

  if (uploadError) throw uploadError;

  const dates = performances.map(({ date }) => date).sort();

  const { error: slotError } = await admin.from("slots").upsert(
    performances.map(({ date, time }) => ({ show_id: showId, date, time })),
    { onConflict: "show_id,date,time", ignoreDuplicates: true },
  );

  if (slotError) throw slotError;

  const { data: slots, error: slotSelectError } = await admin
    .from("slots")
    .select("id, date, time")
    .eq("show_id", showId)
    .gte("date", dates[0])
    .lte("date", dates[dates.length - 1]);

  if (slotSelectError) throw slotSelectError;

  const slotIdByKey = new Map(
    // time -> HH:mm:ss
    slots.map(({ id, date, time }) => [`${date} ${time.slice(0, 5)}`, id]),
  );

  const actorNames = [
    ...new Set(performances.flatMap(({ casting }) => Object.values(casting))),
  ];

  const { error: actorError } = await admin
    .from("actors")
    .upsert(
      actorNames.map((name) => ({ name })),
      { onConflict: "name", ignoreDuplicates: true },
    );

  if (actorError) throw actorError;

  const { data: actors, error: actorSelectError } = await admin
    .from("actors")
    .select("id, name")
    .in("name", actorNames);

  if (actorSelectError) throw actorSelectError;

  const actorIdByName = new Map(actors.map(({ id, name }) => [name, id]));

  const assignments = performances.flatMap(({ date, time, casting }) => {
    const slotId = slotIdByKey.get(`${date} ${time}`);

    if (!slotId) return [];

    return Object.entries(casting).map(([role, actor]) => ({
      upload_id: upload.id,
      slot_id: slotId,
      role_name_raw: role,
      actor_name_raw: actor,
      actor_id: actorIdByName.get(actor) ?? null,
    }));
  });

  const { error: assignmentError } = await admin
    .from("assignments")
    .upsert(assignments, {
      onConflict: "upload_id,slot_id,role_name_raw",
      ignoreDuplicates: true,
    });

  if (assignmentError) throw assignmentError;

  return {
    uploadId: upload.id,
    slotCount: performances.length,
    actorCount: actorNames.length,
    skippedCount,
  };
}
