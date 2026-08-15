import { GoogleGenAI } from "@google/genai";
import * as z from "zod";

import {
  addMonths,
  getToday,
  getWeekday,
  toInputDate,
  toIsoDate,
} from "@/lib/date";
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
    reason: {
      type: "string",
      description:
        "Korean explanation for why performances is empty or clearly incomplete (e.g. image too blurry to read, no table found, header row missing). Omit when parsing succeeded normally.",
    },
  },
  required: ["performances"],
} satisfies z.core.JSONSchema.JSONSchema;

const castingSchema = z.fromJSONSchema(castingJsonSchema);

const buildPrompt = (show: ShowDetail) => {
  const { from, to } = resolveRunWindow(show);

  return `
Extract the casting schedule table from this image.

The image is a casting board for:
- Title: ${show.prfnm}
- Run: ${from} ~ ${to}

Rules:
- Rows are performances (date and time), columns are roles, cells are actor names.
- The board usually omits the year. Resolve every date using the run above.
- Drop any row whose date falls outside the run.
- A merged cell applies to every row or column it spans.
- If a time cell lists multiple times separated by a slash (e.g. "13:00/15:00"), output one performance per time, each with the same casting as that row.
- Skip any row that indicates there is no performance that day (e.g. "공연 없음"); do not include it in "performances".
- Use the role names in the header row as the keys of "casting".
- Omit a cell from "casting" when it is empty or a placeholder such as "-".
- If no casting table exists, return an empty performances array.
- If multiple tables exist, use only the largest and most complete one.
- Make your best guess for ambiguous text, but never invent a performance that is not visible.
- If "performances" ends up empty or clearly incomplete, briefly explain why in Korean in "reason" (e.g. image too blurry, no table found, header row missing).
`;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const PLACEHOLDER_NAMES = new Set(["", "-", "–", "—", "미정", "n/a", "N/A"]);

const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ");

function resolveRunWindow(show: ShowDetail) {
  if (show.openrun !== "Y")
    return { from: toIsoDate(show.prfpdfrom), to: toIsoDate(show.prfpdto) };
  else
    return {
      from: toInputDate(addMonths(getToday(), -3)),
      to: toInputDate(addMonths(getToday(), 3)),
    };
}

function parseCastNames(prfcast?: string): Set<string> {
  if (!prfcast) return new Set(); // 캐스트를 제공하지 않을 시 체크를 건너뛴다

  return new Set(
    prfcast
      .split(/[,/·\n]/)
      .map((name) => normalizeName(name).replace(/\s*등$/, ""))
      .filter(Boolean),
  );
}

export function hasKnownCastOverlap(
  performances: ParsedPerformance[],
  show: ShowDetail,
) {
  // 오픈런은 prfcast가 개막 당시 캐스팅이라 수년 지나면 지금 캐스팅과 안 겹칠 수 있어 대조 자체를 건너뛴다
  if (show.openrun === "Y") return true;

  const known = parseCastNames(show.prfcast);

  // 겹치는 이름이 하나도 없을 때 다른 공연의 캐스트로 판단
  if (known.size === 0) return true;

  const extracted = performances.flatMap(({ casting }) =>
    Object.values(casting),
  );

  return extracted.some((name) => known.has(normalizeName(name)));
}

// Gemini 응답의 값을 보장하기 위해 여기서 한 번 더 거른다
function normalizePerformances(
  performances: ParsedPerformance[],
  show: ShowDetail,
) {
  const { from, to } = resolveRunWindow(show);

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
          ([role, actor]) =>
            role && !PLACEHOLDER_NAMES.has(actor.toLowerCase()),
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

  const parsed = castingSchema.parse(raw) as {
    performances: ParsedPerformance[];
    reason?: string;
  };

  return { ...normalizePerformances(parsed.performances, show), reason: parsed.reason };
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

  const { data: upload, error: uploadError } = await admin
    .from("uploads")
    .insert({ show_id: showId, user_id: userId })
    .select("id")
    .single();

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = admin.storage.from(CASTING_BOARD_BUCKET).getPublicUrl(storagePath);

  const { data: uploadImage, error: uploadImageError } = await admin
    .from("upload_images")
    .insert({ upload_id: upload.id, url: publicUrl, position: 0 })
    .select("id")
    .single();

  if (uploadImageError) throw uploadImageError;

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

  const { error: actorError } = await admin.from("actors").upsert(
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
      upload_image_id: uploadImage.id,
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
