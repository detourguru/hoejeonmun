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
  ConfirmedEvent,
  EventConfirmReason,
  EventSource,
  ExistingEvent,
  ParsedDateTag,
  ParsedEvent,
  ParsedPerformance,
  PendingEvent,
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
        "Every badge printed on the casting board that marks a date or a run of dates (e.g. Preview/프리뷰, 막공, a curtain-call marker, or a side label spanning several rows such as 더블적립위크). One entry per badge, covering the whole run it marks.",
      items: {
        type: "object",
        properties: {
          tag: {
            type: "string",
            description:
              "The badge's text, verbatim (e.g. 프리뷰, 막공, 커튼콜데이).",
          },
          startDate: {
            type: "string",
            description: "YYYY-MM-DD, the first date this badge marks.",
          },
          endDate: {
            type: "string",
            description:
              "YYYY-MM-DD, the last date this badge marks. Same as startDate when the badge sits on a single date.",
          },
          printedStartWeekday: {
            type: "string",
            description:
              'The weekday printed on the board next to startDate, copied as-is (월, 화, 수, 목, 금, 토, 일). Return "" when the board prints no weekday there. Never derive this from startDate.',
          },
          printedEndWeekday: {
            type: "string",
            description:
              'The weekday printed on the board next to endDate, copied as-is. Return "" when the board prints no weekday there. Never derive this from endDate.',
          },
          imageIndex: {
            type: "integer",
            description:
              "0-based index of which image (in the order provided) this badge was read from.",
          },
        },
        required: [
          "tag",
          "startDate",
          "endDate",
          "printedStartWeekday",
          "printedEndWeekday",
          "imageIndex",
        ],
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
          rawTitle: {
            type: "string",
            description:
              'The show/production title as printed on this poster, usually near the logo (Korean and/or English). Copy it exactly as shown. Required even if it duplicates text already used for "title".',
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
          printedStartWeekday: {
            type: "string",
            description:
              'The weekday printed on the notice next to the start date, copied as-is (e.g. "8/19(수)" -> "수"). Return "" when the notice prints no weekday there. Never derive this from periodStart.',
          },
          printedEndWeekday: {
            type: "string",
            description:
              'The weekday printed on the notice next to the end date, copied as-is. Return "" when the notice prints no weekday there. Never derive this from periodEnd.',
          },
          imageIndex: {
            type: "integer",
            description:
              "0-based index of which image (in the order provided) this event was read from.",
          },
        },
        required: [
          "title",
          "rawTitle",
          "periodStart",
          "periodEnd",
          "printedStartWeekday",
          "printedEndWeekday",
          "imageIndex",
        ],
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

Each image is either a casting board or an event/perk notice. Classify each image using exactly one rule: does it pair actor names with role/character names (e.g. "엘리자벳", "토드" -- names from the show's own story), the way a cast list does?
- Yes -> it is a casting board. Follow "Casting board rules" below and extract into "performances" and "dateTags". This stays true even if some dates also carry an inline badge — a badge never changes the classification.
- No -> it is an event/perk notice. This covers anything tied to a date or date range that is not a role-labeled cast -- a giveaway, a discount, a signing/high-touch session, a special curtain call, a farewell greeting, a schedule/scene change notice, etc. Do not require specific keywords; judge by what the image is actually about. This also covers tables that list actor names grouped by something other than a role (e.g. by song/scene title, like a "special curtain call" lineup) -- treat those as an event tied to that date/range and capture only the title and dates, not a per-actor breakdown. Follow "Event rules" below and extract into "events". Only leave both arrays empty (and explain why in "reason") when the image is unreadable or has no date information at all.

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
- Separately, scan every date in the table (not just a sample) for an inline badge next to or on the date, such as "Preview"/"프리뷰", "막공", or a curtain-call marker, and add one "dateTags" entry per badge with "startDate" and "endDate" both set to that date -- once per date, even when that date has multiple performance times. This is a distinct pass from building "performances": go date by date in order and check each one individually, since it is easy to skip one in a long list, especially when neighboring dates look visually identical. Do not skip a date just because nearby dates already got the same tag.
- Some boards instead mark a whole run of dates at once, e.g. a colored label in the margin spanning several rows (such as "더블적립위크" or "장면시연위크" covering a week). Add a single "dateTags" entry for the whole run: "startDate" is the first date the label covers and "endDate" is the last. Do not expand a run into one entry per day.
- A single date can carry more than one badge at once (e.g. a closing performance that is also a curtain-call day). In that case, add a separate "dateTags" entry for each badge on that date, rather than picking just one.
- Fill "printedStartWeekday"/"printedEndWeekday" by copying the weekday the board prints next to that date. Never derive a weekday from the date; return "" when the board prints none there.

Event rules:
- An event/perk notice describes a promotion tied to a date or date range (e.g. a Polaroid giveaway, an autograph postcard giveaway, an opening-week event), not a cast.
- A line stating that something will NOT happen is not an event but a note about its absence (e.g. "스페셜 커튼콜 주차에는 에필로그 장면은 진행되지 않습니다"). Skip it, even when it names a date range.
- A staged segment that an audience member would plan around IS an event, including one that rotates by period (e.g. "Epilogue 1 - 어부와 작가" one week, a different one the next). Extract each period as its own entry.
- Extract its Korean title, an optional longer description, and the date range it runs in "periodStart"/"periodEnd" (use the same date for both when it runs a single day).
- Fill "printedStartWeekday"/"printedEndWeekday" by copying the weekday the notice prints next to that date (e.g. "8/19(수) - 8/23(일)" -> "수" and "일"). Never derive a weekday from the date; return "" when the notice prints none there.
- Also read the show/production title printed on the poster itself (usually near a logo) and put it verbatim in "rawTitle". Copy what is printed -- do not translate it, expand it, or adjust it toward any other title you have been given.
- If one image shows several distinct events (e.g. a calendar listing multiple weekly promotions), extract each as its own entry in "events".

Make your best guess for ambiguous text, but never invent a performance or event that is not visible.
If both "performances" and "events" end up empty or clearly incomplete, briefly explain why in Korean in "reason" (e.g. image too blurry, no table or event notice found, header row missing).
`;
};

const sameShowJsonSchema = {
  type: "object",
  properties: {
    isSame: {
      type: "boolean",
      description: "true when A and B name the same production.",
    },
  },
  required: ["isSame"],
} satisfies z.core.JSONSchema.JSONSchema;

const sameShowSchema = z.fromJSONSchema(sameShowJsonSchema);

const buildSameShowPrompt = (titleA: string, titleB: string) => `
Two strings are given, each taken from the material of a stage production.

A: ${titleA}
B: ${titleB}

Decide whether A and B name the same production.
- Same when one is a transliteration or translation of the other (e.g. "BROKEBACK MOUNTAIN" and "브로크백 마운틴").
- Same when one carries a genre, region, venue, season, or edition marker the other omits (e.g. "MUSICAL", "뮤지컬", "[대학로]", "2026", "내한").
- Different when the underlying work differs, even if the genre or wording is similar.
`;

// 로마자 로고와 한글 공연명은 문자가 겹치지 않아 문자열 대조로는 판정할 수 없다
async function namesSameShow(prfnm: string, printedTitle: string) {
  const client = new GoogleGenAI({});

  const interaction = await client.interactions.create({
    model: MODEL,
    input: [{ type: "text", text: buildSameShowPrompt(prfnm, printedTitle) }],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: sameShowJsonSchema,
    },
  });

  if (!interaction.output_text) {
    throw new Error("Gemini가 응답하지 않았습니다");
  }

  const { isSame } = sameShowSchema.parse(
    JSON.parse(interaction.output_text),
  ) as { isSame: boolean };

  return isSame;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const PLACEHOLDER_NAMES = new Set(["", "-", "–", "—", "미정", "n/a", "N/A"]);

const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ");

// KOPIS는 공연명 뒤에 "[대학로]" 같은 지역 표기를 붙여 주는 경우가 있으므로 정규화
const stripKopisRegionTag = (title: string) => title.replace(/\[[^\]]*\]/g, "");

const normalizeTitle = (title: string) =>
  stripKopisRegionTag(title)
    .toLowerCase()
    .replace(/[\s·・:,.\-()[\]{}'"!?]/g, "");

const titlesOverlap = (a: string, b: string) =>
  a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a));

const agreesWithPrintedWeekday = (isoDate: string, printed: string) =>
  printed.length === 0 || getWeekday(isoDate) === printed;

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

async function lookupTitleAliases(showTitleKey: string, printedKeys: string[]) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("show_title_aliases")
    .select("printed_title_key, is_same")
    .eq("show_title_key", showTitleKey)
    .in("printed_title_key", printedKeys);

  if (error) {
    console.error("공연명 별칭 조회 실패", error);

    return new Map<string, boolean>();
  }

  return new Map<string, boolean>(
    data.map(({ printed_title_key, is_same }) => [printed_title_key, is_same]),
  );
}

async function rememberTitleAlias(alias: {
  showTitleKey: string;
  printedTitleKey: string;
  printedTitle: string;
  isSame: boolean;
}) {
  const admin = createAdminClient();

  const { error } = await admin.from("show_title_aliases").upsert(
    {
      show_title_key: alias.showTitleKey,
      printed_title_key: alias.printedTitleKey,
      printed_title: alias.printedTitle,
      is_same: alias.isSame,
    },
    { onConflict: "show_title_key,printed_title_key", ignoreDuplicates: true },
  );

  if (error) console.error("공연명 별칭 저장 실패", error);
}

export async function isEventForShow(events: ParsedEvent[], show: ShowDetail) {
  if (events.length === 0) return true;

  const showTitleKey = normalizeTitle(show.prfnm);

  if (!showTitleKey) return true;

  const printed = [...new Set(events.map(({ rawTitle }) => rawTitle.trim()))]
    .map((title) => ({ title, key: normalizeTitle(title) }))
    .filter(({ key }) => key.length > 0);

  if (printed.length === 0) return true;

  if (printed.some(({ key }) => titlesOverlap(showTitleKey, key))) return true;

  const decided = await lookupTitleAliases(
    showTitleKey,
    printed.map(({ key }) => key),
  );

  if ([...decided.values()].some(Boolean)) return true;

  for (const { title, key } of printed) {
    if (decided.has(key)) continue;

    let isSame: boolean;

    try {
      isSame = await namesSameShow(show.prfnm, title);
    } catch (error) {
      console.error("공연명 대조 실패", error);

      return true;
    }

    await rememberTitleAlias({
      showTitleKey,
      printedTitleKey: key,
      printedTitle: title,
      isSame,
    });

    if (isSame) return true;
  }

  return false;
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
  performances: ParsedPerformance[],
) {
  const { from, to } = resolveRunWindow(show);

  const seen = new Set<string>();
  const valid: ParsedDateTag[] = [];

  for (const dateTag of dateTags) {
    const tag = dateTag.tag?.trim() ?? "";
    const startDate = dateTag.startDate?.trim() ?? "";
    const endDate = dateTag.endDate?.trim() ?? "";
    const printedStartWeekday = dateTag.printedStartWeekday?.trim() ?? "";
    const printedEndWeekday = dateTag.printedEndWeekday?.trim() ?? "";

    const key = `${startDate}~${endDate}::${tag}`;

    const isValid =
      tag.length > 0 &&
      DATE_PATTERN.test(startDate) &&
      DATE_PATTERN.test(endDate) &&
      startDate <= endDate &&
      startDate >= from &&
      endDate <= to &&
      agreesWithPrintedWeekday(startDate, printedStartWeekday) &&
      agreesWithPrintedWeekday(endDate, printedEndWeekday) &&
      // 표의 행에 붙은 배지이므로 그 구간에 회차가 하나도 없으면 잘못 읽은 것이다
      performances.some(({ date }) => date >= startDate && date <= endDate) &&
      !seen.has(key) &&
      Number.isInteger(dateTag.imageIndex) &&
      dateTag.imageIndex >= 0 &&
      dateTag.imageIndex < imageCount;

    if (!isValid) continue;

    seen.add(key);
    valid.push({
      tag,
      startDate,
      endDate,
      printedStartWeekday,
      printedEndWeekday,
      imageIndex: dateTag.imageIndex,
    });
  }

  return valid;
}

const EVENT_PRIORITY: Record<EventSource, number> = { badge: 0, notice: 1 };

const priorityOf = (source: EventSource, edited: boolean) =>
  edited ? EVENT_PRIORITY.notice + 1 : EVENT_PRIORITY[source];

export function unverifiedPoints(event: {
  source: EventSource;
  periodStart: string;
  periodEnd: string;
  printedStartWeekday: string;
  printedEndWeekday: string;
}): EventConfirmReason[] {
  const reasons: EventConfirmReason[] = [];

  if (event.source === "badge" && event.periodStart !== event.periodEnd) {
    reasons.push("range_badge");
  }

  if (!event.printedStartWeekday || !event.printedEndWeekday) {
    reasons.push("no_printed_weekday");
  }

  return reasons;
}

export function toPendingEvents(
  dateTags: ParsedDateTag[],
  events: ParsedEvent[],
): PendingEvent[] {
  const fromNotices = events.map(
    ({
      title,
      description,
      periodStart,
      periodEnd,
      printedStartWeekday,
      printedEndWeekday,
      imageIndex,
    }) => ({
      title,
      description,
      periodStart,
      periodEnd,
      printedStartWeekday,
      printedEndWeekday,
      imageIndex,
      source: "notice" as const,
    }),
  );

  const fromBadges = dateTags.map(({ tag, startDate, endDate, ...dateTag }) => ({
    ...dateTag,
    title: tag,
    periodStart: startDate,
    periodEnd: endDate,
    source: "badge" as const,
  }));

  return [...fromNotices, ...fromBadges].map((event) => ({
    ...event,
    confirmReasons: unverifiedPoints(event),
    overlapping: [],
  }));
}

const toExistingEvent = (row: {
  id: number;
  title: string;
  period_start: string;
  period_end: string;
  source: EventSource;
  edited: boolean;
}): ExistingEvent => ({
  id: row.id,
  title: row.title,
  periodStart: row.period_start,
  periodEnd: row.period_end,
  source: row.source,
  edited: row.edited,
});

export async function attachOverlappingEvents(
  showId: string,
  pending: PendingEvent[],
): Promise<PendingEvent[]> {
  if (pending.length === 0) return pending;

  const from = pending.map(({ periodStart }) => periodStart).sort()[0];
  const to = pending.map(({ periodEnd }) => periodEnd).sort().at(-1)!;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("visible_events")
    .select("id, title, period_start, period_end, source, edited")
    .eq("show_id", showId)
    .lte("period_start", to)
    .gte("period_end", from);

  if (error) throw error;

  const existing = data.map(toExistingEvent);

  return pending.map((event) => {
    const overlapping = existing.filter(
      ({ periodStart, periodEnd }) =>
        periodStart <= event.periodEnd && event.periodStart <= periodEnd,
    );

    if (overlapping.length === 0) return event;

    return {
      ...event,
      overlapping,
      confirmReasons: [...event.confirmReasons, "overlaps_existing" as const],
    };
  });
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
    const rawTitle = event.rawTitle?.trim() ?? "";
    const periodStart = event.periodStart?.trim() ?? "";
    const periodEnd = event.periodEnd?.trim() ?? "";
    const printedStartWeekday = event.printedStartWeekday?.trim() ?? "";
    const printedEndWeekday = event.printedEndWeekday?.trim() ?? "";
    const description = event.description?.trim() || undefined;

    const isValid =
      title.length > 0 &&
      DATE_PATTERN.test(periodStart) &&
      DATE_PATTERN.test(periodEnd) &&
      periodStart <= periodEnd &&
      // 공연 기간과 아예 안 겹치는 이벤트는 다른 공연 것으로 판단
      periodStart <= to &&
      periodEnd >= from &&
      agreesWithPrintedWeekday(periodStart, printedStartWeekday) &&
      agreesWithPrintedWeekday(periodEnd, printedEndWeekday) &&
      Number.isInteger(event.imageIndex) &&
      event.imageIndex >= 0 &&
      event.imageIndex < imageCount;

    if (!isValid) continue;

    valid.push({
      title,
      rawTitle,
      description,
      periodStart,
      periodEnd,
      printedStartWeekday,
      printedEndWeekday,
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
    dateTags: normalizeDateTags(
      parsed.dateTags,
      show,
      imageBlocks.length,
      performances,
    ),
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
  type: "no_table_found" | "cast_mismatch" | "show_mismatch" | "exception";
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

type EventRow = {
  show_id: string;
  upload_id: number;
  upload_image_id: number;
  slot_id: null;
  title: string;
  description: string | null;
  period_start: string;
  period_end: string;
  source: EventSource;
  edited_by: string | null;
};

// PostgreSQL 에러 코드: unique_violation
const DUPLICATE_KEY = "23505";

async function insertEvent(
  admin: ReturnType<typeof createAdminClient>,
  row: EventRow,
) {
  const { error } = await admin.from("events").insert(row);

  if (error && error.code !== DUPLICATE_KEY) throw error;

  return !error;
}

async function replaceEvent(
  admin: ReturnType<typeof createAdminClient>,
  eventId: number,
  row: EventRow,
) {
  const { data: current, error } = await admin
    .from("events")
    .select("source, edited_by")
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw error;

  // 신고로 내려갔거나 그 사이 지워졌으면 새로 넣는다
  if (!current) return insertEvent(admin, row);

  const incoming = priorityOf(row.source, row.edited_by !== null);

  if (incoming < priorityOf(current.source, current.edited_by !== null)) {
    return false;
  }

  const { error: updateError } = await admin
    .from("events")
    .update(row)
    .eq("id", eventId);

  if (updateError && updateError.code !== DUPLICATE_KEY) throw updateError;

  return !updateError;
}

export async function saveCastingBoard({
  showId,
  userId,
  storagePaths,
  performances,
  events,
  skippedCount,
}: {
  showId: string;
  userId: string;
  storagePaths: string[];
  performances: ParsedPerformance[];
  events: ConfirmedEvent[];
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

  let eventCount = 0;

  for (const event of events) {
    const uploadImageId = uploadImageIdByPosition.get(event.imageIndex);

    if (uploadImageId === undefined) continue;

    const row = {
      show_id: showId,
      upload_id: upload.id,
      upload_image_id: uploadImageId,
      slot_id: null,
      title: event.title,
      description: event.description ?? null,
      period_start: event.periodStart,
      period_end: event.periodEnd,
      source: event.source,
      edited_by: event.edited ? userId : null,
    };

    const saved =
      event.replacesEventId === undefined
        ? await insertEvent(admin, row)
        : await replaceEvent(admin, event.replacesEventId, row);

    if (saved) eventCount += 1;
  }

  return {
    uploadId: upload.id,
    slotCount: performances.length,
    actorCount: actorNames.length,
    eventCount,
    skippedCount,
  };
}
