import { GoogleGenAI } from "@google/genai";
import * as z from "zod";

import {
  addMonths,
  getToday,
  getWeekday,
  toInputDate,
  toIsoDate,
} from "@/lib/date";
import { normalizeActorName, splitActorNames } from "@/lib/actor-name";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CASTING_BOARD_BUCKET,
  CastingBoardResult,
  ParsedDateTag,
  ParsedEvent,
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
          imageIndex: {
            type: "integer",
            description:
              "0-based index of which image (in the order provided) this row was read from. Used to link this performance back to its source image.",
          },
        },
        required: ["date", "weekday", "time", "casting", "imageIndex"],
      },
    },
    dateTags: {
      type: "array",
      description:
        "Every date that carries a special inline badge on the casting board (e.g. Preview/프리뷰, 막공, a curtain-call marker), listed once per date -- not once per performance row, even if that date has multiple times.",
      items: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: 'YYYY-MM-DD, matching a date in "performances".',
          },
          tag: {
            type: "string",
            description:
              "The badge's text, verbatim (e.g. 프리뷰, 막공, 커튼콜데이).",
          },
          imageIndex: {
            type: "integer",
            description:
              "0-based index of which image (in the order provided) this badge was read from.",
          },
        },
        required: ["date", "tag", "imageIndex"],
      },
    },
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Korean event/perk name, e.g. 폴라로이드 증정.",
          },
          description: {
            type: "string",
            description: "Extra details about the event, if any.",
          },
          periodStart: {
            type: "string",
            description: "Event start date in YYYY-MM-DD format.",
          },
          periodEnd: {
            type: "string",
            description:
              "Event end date in YYYY-MM-DD format. Same as periodStart for a single-day event.",
          },
          imageIndex: {
            type: "integer",
            description:
              "0-based index of which image (in the order provided) this event was read from.",
          },
        },
        required: ["title", "periodStart", "periodEnd", "imageIndex"],
      },
    },
    reason: {
      type: "string",
      description:
        "Korean explanation for why both performances and events are empty or clearly incomplete (e.g. image too blurry to read, no table or event notice found, header row missing). Omit when parsing succeeded normally.",
    },
  },
  required: ["performances", "dateTags", "events"],
} satisfies z.core.JSONSchema.JSONSchema;

const castingSchema = z.fromJSONSchema(castingJsonSchema);

const buildPrompt = (show: ShowDetail) => {
  const { from, to } = resolveRunWindow(show);

  return `
Extract information from the given image(s) for:
- Title: ${show.prfnm}
- Run: ${from} ~ ${to}

Each image is either a casting board or an event/perk notice. Classify each image using exactly one rule: does it pair actor names with role names?
- Yes -> it is a casting board. Follow "Casting board rules" below and extract into "performances" and "dateTags". This stays true even if some dates also carry an inline badge — a badge never changes the classification.
- No -> check whether it instead announces an event: does it mention a date or date range together with promotional wording (e.g. 증정, 이벤트, 데이, 오프닝, 커튼콜)? If so, follow "Event rules" below and extract into "events". If neither condition holds, leave both arrays empty and explain why in "reason".

Casting board rules:
- Rows are performances (date and time), columns are roles, cells are actor names.
- Multiple images may be given. They may be continuous parts of the same table (e.g. a scrolled screenshot split into pieces), and the header row with role names may appear in only one of them.
- The board usually omits the year. Resolve every date using the run above.
- Drop any row whose date falls outside the run.
- A merged cell applies to every row or column it spans.
- If a time cell lists multiple times separated by a slash (e.g. "13:00/15:00"), output one performance per time, each with the same casting as that row.
- Skip any row that indicates there is no performance that day (e.g. "공연 없음"); do not include it in "performances".
- Use the role names in the header row as the keys of "casting".
- Some boards instead show a cast legend once (actor photo/name paired with a role name, e.g. "김지훈 - 빅터 프랑켄슈타인") separate from the schedule rows, and each row just lists actor names in a fixed order with no role labels. In that case, match each name in a row to a role by its position in the legend's order, and use the legend's role names as the keys of "casting".
- Omit a cell from "casting" when it is empty or a placeholder such as "-".
- If no casting table exists, return an empty performances array.
- If multiple tables exist, use only the largest and most complete one.
- Separately, scan every date in the table (not just a sample) for an inline badge next to or on the date, such as "Preview"/"프리뷰", "막공", or a curtain-call marker, and list each such date once in "dateTags" with the badge's verbatim text -- once per date, even when that date has multiple performance times. This is a distinct pass from building "performances": go date by date in order and check each one individually, since it is easy to skip one in a long list, especially when neighboring dates look visually identical. Do not skip a date just because nearby dates already got the same tag.

Event rules:
- An event/perk notice describes a promotion tied to a date or date range (e.g. a Polaroid giveaway, an autograph postcard giveaway, an opening-week event), not a cast.
- Extract its Korean title, an optional longer description, and the date range it runs in "periodStart"/"periodEnd" (use the same date for both when it runs a single day).
- If one image shows several distinct events (e.g. a calendar listing multiple weekly promotions), extract each as its own entry in "events".

Make your best guess for ambiguous text, but never invent a performance or event that is not visible.
If both "performances" and "events" end up empty or clearly incomplete, briefly explain why in Korean in "reason" (e.g. image too blurry, no table or event notice found, header row missing).
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
  return new Set(splitActorNames(prfcast));
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
  imageCount: number,
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
        .map(([role, actor]) => [
          normalizeName(role),
          normalizeActorName(actor),
        ])
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
      !seen.has(key) &&
      Number.isInteger(performance.imageIndex) &&
      performance.imageIndex >= 0 &&
      performance.imageIndex < imageCount;

    if (!isValid) {
      skippedCount += 1;
      continue;
    }

    seen.add(key);
    valid.push({
      date,
      time,
      weekday: performance.weekday,
      casting,
      imageIndex: performance.imageIndex,
    });
  }

  return { performances: valid, skippedCount };
}

// Gemini 응답의 값을 보장하기 위해 여기서 한 번 더 거른다
function normalizeDateTags(
  dateTags: ParsedDateTag[],
  show: ShowDetail,
  imageCount: number,
) {
  const { from, to } = resolveRunWindow(show);

  const seen = new Set<string>();
  const valid: ParsedDateTag[] = [];

  for (const dateTag of dateTags) {
    const date = dateTag.date?.trim() ?? "";
    const tag = dateTag.tag?.trim() ?? "";

    const isValid =
      tag.length > 0 &&
      DATE_PATTERN.test(date) &&
      date >= from &&
      date <= to &&
      !seen.has(date) &&
      Number.isInteger(dateTag.imageIndex) &&
      dateTag.imageIndex >= 0 &&
      dateTag.imageIndex < imageCount;

    if (!isValid) continue;

    seen.add(date);
    valid.push({ date, tag, imageIndex: dateTag.imageIndex });
  }

  return valid;
}

// Gemini 응답의 값을 보장하기 위해 여기서 한 번 더 거른다
function normalizeEvents(
  events: ParsedEvent[],
  show: ShowDetail,
  imageCount: number,
) {
  const { from, to } = resolveRunWindow(show);

  const valid: ParsedEvent[] = [];

  for (const event of events) {
    const title = event.title?.trim() ?? "";
    const periodStart = event.periodStart?.trim() ?? "";
    const periodEnd = event.periodEnd?.trim() ?? "";
    const description = event.description?.trim() || undefined;

    const isValid =
      title.length > 0 &&
      DATE_PATTERN.test(periodStart) &&
      DATE_PATTERN.test(periodEnd) &&
      periodStart <= periodEnd &&
      // 공연 기간과 아예 안 겹치는 이벤트는 다른 공연 것으로 판단
      periodStart <= to &&
      periodEnd >= from &&
      Number.isInteger(event.imageIndex) &&
      event.imageIndex >= 0 &&
      event.imageIndex < imageCount;

    if (!isValid) continue;

    valid.push({
      title,
      description,
      periodStart,
      periodEnd,
      imageIndex: event.imageIndex,
    });
  }

  return valid;
}

export async function parseCastingBoard(images: Blob[], show: ShowDetail) {
  const imageBlocks = await Promise.all(
    images.map(async (image) => ({
      type: "image" as const,
      data: Buffer.from(await image.arrayBuffer()).toString("base64"),
      mime_type: image.type || "image/jpeg",
    })),
  );

  const client = new GoogleGenAI({});

  const interaction = await client.interactions.create({
    model: MODEL,
    input: [{ type: "text", text: buildPrompt(show) }, ...imageBlocks],
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
    dateTags: ParsedDateTag[];
    events: ParsedEvent[];
    reason?: string;
  };

  const { performances, skippedCount } = normalizePerformances(
    parsed.performances,
    show,
    imageBlocks.length,
  );

  return {
    performances,
    skippedCount,
    dateTags: normalizeDateTags(parsed.dateTags, show, imageBlocks.length),
    events: normalizeEvents(parsed.events, show, imageBlocks.length),
    reason: parsed.reason,
  };
}

// 파싱 실패 사례
export async function logParseFailure({
  admin,
  showId,
  userId,
  storagePaths,
  type,
  reason,
}: {
  admin: ReturnType<typeof createAdminClient>;
  showId: string;
  userId: string;
  storagePaths: string[];
  type: "no_table_found" | "cast_mismatch" | "exception";
  reason?: string;
}) {
  const { error } = await admin.from("parse_failures").insert(
    storagePaths.map((storagePath) => ({
      show_id: showId,
      user_id: userId,
      storage_path: storagePath,
      type,
      reason,
    })),
  );

  if (error) console.error("parse_failures insert 실패", error);
}

export async function saveCastingBoard({
  showId,
  userId,
  storagePaths,
  performances,
  dateTags,
  events,
  skippedCount,
}: {
  showId: string;
  userId: string;
  storagePaths: string[];
  performances: ParsedPerformance[];
  dateTags: ParsedDateTag[];
  events: ParsedEvent[];
  skippedCount: number;
}): Promise<CastingBoardResult> {
  const admin = createAdminClient();

  const { data: upload, error: uploadError } = await admin
    .from("uploads")
    .insert({ show_id: showId, user_id: userId })
    .select("id")
    .single();

  if (uploadError) throw uploadError;

  const { data: uploadImages, error: uploadImagesError } = await admin
    .from("upload_images")
    .insert(
      storagePaths.map((storagePath, position) => ({
        upload_id: upload.id,
        url: admin.storage.from(CASTING_BOARD_BUCKET).getPublicUrl(storagePath)
          .data.publicUrl,
        position,
      })),
    )
    .select("id, position");

  if (uploadImagesError) throw uploadImagesError;

  const uploadImageIdByPosition = new Map(
    uploadImages.map(({ id, position }) => [position, id]),
  );

  // 이벤트 안내만 있고 캐스팅표는 없는 업로드일 수 있다
  let actorNames: string[] = [];

  if (performances.length > 0) {
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

    actorNames = [
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

    const assignments = performances.flatMap(
      ({ date, time, casting, imageIndex }) => {
        const slotId = slotIdByKey.get(`${date} ${time}`);
        const uploadImageId = uploadImageIdByPosition.get(imageIndex);

        if (!slotId || uploadImageId === undefined) return [];

        return Object.entries(casting).map(([role, actor]) => ({
          upload_id: upload.id,
          slot_id: slotId,
          role_name_raw: role,
          actor_name_raw: actor,
          actor_id: actorIdByName.get(actor) ?? null,
          upload_image_id: uploadImageId,
        }));
      },
    );

    const { error: assignmentError } = await admin
      .from("assignments")
      .upsert(assignments, {
        onConflict: "upload_id,slot_id,role_name_raw",
        ignoreDuplicates: true,
      });

    if (assignmentError) throw assignmentError;
  }

  // 캐스팅표 안 날짜별 배지는 그 날짜 하루짜리 이벤트로 파생시킨다.
  const derivedEvents = dateTags.flatMap(({ date, tag, imageIndex }) => {
    const uploadImageId = uploadImageIdByPosition.get(imageIndex);

    if (uploadImageId === undefined) return [];

    return [
      {
        show_id: showId,
        upload_id: upload.id,
        upload_image_id: uploadImageId,
        slot_id: null,
        title: tag,
        description: null,
        period_start: date,
        period_end: date,
      },
    ];
  });

  // 이미지 전체가 이벤트 안내로 분류된 경우
  const standaloneEvents = events.flatMap(
    ({ title, description, periodStart, periodEnd, imageIndex }) => {
      const uploadImageId = uploadImageIdByPosition.get(imageIndex);

      if (uploadImageId === undefined) return [];

      return [
        {
          show_id: showId,
          upload_id: upload.id,
          upload_image_id: uploadImageId,
          slot_id: null,
          title,
          description: description ?? null,
          period_start: periodStart,
          period_end: periodEnd,
        },
      ];
    },
  );

  const eventRows = [...derivedEvents, ...standaloneEvents];

  if (eventRows.length > 0) {
    const { error: eventError } = await admin.from("events").insert(eventRows);

    if (eventError) throw eventError;
  }

  return {
    uploadId: upload.id,
    slotCount: performances.length,
    actorCount: actorNames.length,
    eventCount: eventRows.length,
    skippedCount,
  };
}
