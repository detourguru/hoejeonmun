import { createHash } from "node:crypto";

import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import * as z from "zod";

import { normalizeActorName, splitActorNames } from "@/lib/actor-name";
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
  ConfirmedEvent,
  EventConfirmReason,
  EventSlotException,
  EventSource,
  ExistingEvent,
  ParsedCancelledEvent,
  ParsedCancelledSlot,
  ParsedCastingChange,
  ParsedDateTag,
  ParsedEvent,
  ParsedPerformance,
  PendingEvent,
  PerformanceSkipReason,
  SkippedPerformance,
} from "@/type/casting";
import { ShowDetail } from "@/type/show";

export const VISION_MODEL = "gemini-3.5-flash-lite";
export const MODEL = "gemini-3.5-flash-lite";

export type ParseCastingBoardOptions = {
  model?: string;
  budgetMs?: number;
  abortSignal?: AbortSignal;
};

export type ParsedCastingBoardResult = {
  performances: ParsedPerformance[];
  skipped: SkippedPerformance[];
  dateTags: ParsedDateTag[];
  events: ParsedEvent[];
  cancelledSlots: ParsedCancelledSlot[];
  castingChanges: ParsedCastingChange[];
  cancelledEvents: ParsedCancelledEvent[];
  reason: string;
};

export const castingJsonSchema = {
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
            description:
              "Role name -> list of actor names playing that role in this performance. Usually one actor per role, but list every actor when a role is shared by several performers at once (e.g. an ensemble role like 목소리들 with multiple names in one cell/column).",
            additionalProperties: {
              type: "array",
              items: { type: "string" },
            },
          },
          imageIndex: {
            type: "integer",
            description:
              "0-based index of which image (in the order provided) this row was read from. Used to link this performance back to its source image.",
          },
          confidence: {
            type: "number",
            description: "Your confidence in this row's parsing, from 0 to 1.",
          },
        },
        required: [
          "date",
          "weekday",
          "time",
          "casting",
          "imageIndex",
          "confidence",
        ],
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
          time: {
            type: "string",
            description:
              'HH:mm. Fill this in only when startDate has more than one performance that day and this badge is printed on just one of those rows, not on every row for that date (e.g. a "첫공" badge on only the 16:00 row while a later 20:00 show the same day carries no badge). Return "" when the badge marks the whole date -- including when that date only has a single performance.',
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
          "time",
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
          includedSlots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string", description: "YYYY-MM-DD" },
                time: { type: "string", description: "HH:mm" },
              },
              required: ["date", "time"],
            },
            description:
              'Specific performance date+times this event ALSO applies to, outside the periodStart/periodEnd range (e.g. notice text like "10/5(월) 15:00, 18:30 회차 포함" when the period itself ends 10/4). Do not fold these into periodEnd -- keep the period as printed and list the extra times here instead. Omit or leave empty when the notice has no such extra inclusion.',
          },
          excludedSlots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string", description: "YYYY-MM-DD" },
                time: { type: "string", description: "HH:mm" },
              },
              required: ["date", "time"],
            },
            description:
              'Specific performance date+times WITHIN the periodStart/periodEnd range that this event does NOT apply to (e.g. "단, 10/2 20:00 회차 제외"). Omit or leave empty when there is no such exclusion.',
          },
          exactTimes: {
            type: "array",
            items: {
              type: "string",
              description: "HH:mm",
            },
            description:
              'When the notice ties this event to specific performance times rather than every performance within the period (e.g. "9/12(토) 19시 회차에는 ~", or "4시&8시 회차에는 ~" naming two times on the same day), list each such time here in HH:mm. This applies to every date in the period, not just one. Omit or leave empty when the event applies to every performance within the period.',
          },
          listedSlots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string", description: "YYYY-MM-DD" },
                time: { type: "string", description: "HH:mm" },
              },
              required: ["date", "time"],
            },
            description:
              'Only when this event is printed as a table with one row per exact date+time (e.g. a 무대인사/커튼콜 schedule listing several rounds), list every one of those rows here as {date, time} -- all of them, including ones already covered by periodStart/periodEnd. This is the literal set of rounds the notice names, used to tell them apart from other same-day performances it does NOT mention. Omit entirely when the notice instead describes a continuous period in prose (e.g. "전 회차", a plain date range) rather than enumerating individual rows.',
          },
          periodStartCutoffTime: {
            type: "string",
            description:
              'HH:mm. Fill this only when a time is printed directly next to periodStart as part of the period label itself (e.g. "9/5(토) 6시 – 9/6(일)" -> periodStart is 9/5 and this is "18:00"), meaning the event applies only from that time onward on periodStart\'s own date, not that date\'s earlier performances. Just copy the printed time -- do not guess which of that date\'s other performances it excludes. Omit when periodStart carries no such attached time.',
          },
          periodEndCutoffTime: {
            type: "string",
            description:
              'HH:mm. Fill this only when a time is printed directly next to periodEnd as part of the period label itself (e.g. "9/1(화) - 9/5(토) 2시" -> periodEnd is 9/5 and this is "14:00"), meaning the event applies only up to and including that time on periodEnd\'s own date, not that date\'s later performances. Just copy the printed time -- do not guess which of that date\'s other performances it excludes. Omit when periodEnd carries no such attached time.',
          },
        },
        required: [
          "title",
          "periodStart",
          "periodEnd",
          "printedStartWeekday",
          "printedEndWeekday",
          "imageIndex",
        ],
      },
    },
    cancelledSlots: {
      type: "array",
      description:
        "Every already-scheduled performance date+time that a cancellation notice says will NOT take place at all (the whole performance is cancelled, not just a segment within it).",
      items: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: "string", description: "HH:mm" },
          imageIndex: {
            type: "integer",
            description:
              "0-based index of which image (in the order provided) this cancellation was read from.",
          },
        },
        required: ["date", "time", "imageIndex"],
      },
    },
    castingChanges: {
      type: "array",
      description:
        "A cast swap announced for a specific already-scheduled performance date+time (e.g. a notice saying a named role will be played by a different actor on one date), as opposed to a full new casting table.",
      items: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: "string", description: "HH:mm" },
          role: {
            type: "string",
            description: "The role/character name being recast.",
          },
          actor: {
            type: "string",
            description: "The new actor's name.",
          },
          imageIndex: {
            type: "integer",
            description:
              "0-based index of which image (in the order provided) this change was read from.",
          },
        },
        required: ["date", "time", "role", "actor", "imageIndex"],
      },
    },
    cancelledEvents: {
      type: "array",
      description:
        "A previously-announced perk/event that this notice says is cancelled or will not proceed.",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The cancelled event's Korean title, as printed.",
          },
          periodStart: {
            type: "string",
            description:
              "YYYY-MM-DD. Best-guess start date of the cancelled event, even if only approximately stated.",
          },
          periodEnd: {
            type: "string",
            description:
              "YYYY-MM-DD. Same as periodStart when it ran a single day.",
          },
          imageIndex: {
            type: "integer",
            description:
              "0-based index of which image (in the order provided) this cancellation was read from.",
          },
        },
        required: ["title", "periodStart", "periodEnd", "imageIndex"],
      },
    },
    reason: {
      type: "string",
      description:
        'Korean, always filled in -- never leave this empty. When performances/dateTags/events/cancelledSlots/castingChanges/cancelledEvents all end up empty or clearly incomplete, explain why in one short sentence (e.g. "이미지가 흐려서 표를 읽지 못함", "캐스팅 표나 이벤트 안내 없음", "헤더 행 누락"). Otherwise, briefly state what was extracted (e.g. "회차 12건, 이벤트 2건 추출"). A human reviewing a failed upload later relies on this field alone, since by then the source image is gone.',
    },
  },
  required: [
    "performances",
    "dateTags",
    "events",
    "cancelledSlots",
    "castingChanges",
    "cancelledEvents",
    "reason",
  ],
} satisfies z.core.JSONSchema.JSONSchema;

const castingSchema = z.fromJSONSchema(castingJsonSchema);

const GEMINI_IMAGE_MAX_WIDTH = 1600;
const GEMINI_IMAGE_MAX_HEIGHT = 3000;
const CASTING_OVERVIEW_SEPARATOR = 16;
const CASTING_OVERVIEW_BACKGROUND = "#ffffff";

type GeminiImageBlock = {
  type: "image";
  data: string;
  mime_type: "image/jpeg";
};

type PreparedCastingImage = {
  index: number;
  buffer: Buffer;
  width: number;
  height: number;
};

export const buildPrompt = (show: ShowDetail) => {
  const { from, to } = resolveRunWindow(show);

  return `
Extract information from the given image(s) for:
- Title: ${show.prfnm}
- Run: ${from} ~ ${to}

Each image can contain one or more distinct sections: a casting board, an event/perk notice, or a cancellation/change notice about something already scheduled or already announced elsewhere. Evaluate each visually distinct table or notice independently. A single image that contains both a casting table and a separate event table must populate both "performances" and "events". Check each section in this order:

1. Cancellation/change notice -- does the image announce any of these about a performance or event that was already scheduled/announced (not a fresh schedule being introduced for the first time)?
   - An entire performance date+time will NOT take place (e.g. an apology notice saying a given date and time's performance is cancelled).
   - A specific already-scheduled performance date+time gets a cast swap (e.g. "a named role will be played by someone else on one date"), as opposed to a full new casting table.
   - A previously-announced perk/event will no longer happen.
   If yes -> it is a cancellation/change notice. Follow "Cancellation/change rules" below and extract into "cancelledSlots" / "castingChanges" / "cancelledEvents" as appropriate. Do not also duplicate this into "performances" or "events".

2. Otherwise, does it pair actor names with role/character names (e.g. "엘리자벳", "토드" -- names from the show's own story), the way a cast list does?
   - Yes -> it is a casting board. Follow "Casting board rules" below and extract into "performances" and "dateTags". This stays true even if some dates also carry an inline badge — a badge never changes the classification.
   - No -> it is an event/perk notice. This covers anything tied to a date or date range that is not a role-labeled cast -- a giveaway, a discount, a signing/high-touch session, a special curtain call, a farewell greeting, a schedule/scene change notice, etc. Do not require specific keywords; judge by what the image is actually about. This also covers tables that list actor names grouped by something other than a role (e.g. by song/scene title, like a "special curtain call" lineup) -- treat those as an event tied to that date/range and capture only the title and dates, not a per-actor breakdown. An event notice does not need to look like a designed poster or table -- plain prose is just as valid a source, including a screenshot of a social media post (e.g. a fan account tweet) that lists one or more dated perks as sentences rather than a table. Follow "Event rules" below and extract into "events".

Only leave every array empty when the image is unreadable or has no date information at all -- and when you do, always explain why in "reason" (see its schema description; this field is required and must never be left empty).

Casting board rules:
- Rows are performances (date and time), columns are roles, cells are actor names.
- Multiple images may be given. They may be continuous parts of the same table (e.g. a scrolled screenshot split into pieces), and the header row with role names may appear in only one of them.
- When several images are clearly one continuous scrolled casting board, first lock in the shared role-column order from whichever image shows the header row, then keep using that same column order for the later cropped images even when those later images themselves do not show the header.
- The locked header belongs only to that one continuous casting-table segment, never to the entire image or upload. Carry it forward only while the following rows preserve the same date/time columns and the same role-column count, order, and horizontal alignment.
- Stop applying the locked header as soon as a new title, separator, header/layout change, missing date/time column, or a table with non-role columns appears. In particular, never use a casting header to interpret a following event/perk table as casting merely because it has dates or actor names. Extract that separate table as an event instead.
- When multiple images are provided, you may also receive one extra stitched overview image that vertically combines them in order. Use that overview only to understand continuity, shared headers, and column alignment across split screenshots; use the individual images for the exact text in each row.
- The board usually omits the year. Resolve every date using the run above.
- Drop any row whose date falls outside the run.
- A merged cell applies to every row or column it spans.
- If a time cell lists multiple times separated by a slash (e.g. "13:00/15:00"), output one performance per time, each with the same casting as that row.
- Skip any row that indicates there is no performance that day (e.g. "공연 없음"); do not include it in "performances".
- Use the role names in the header row as the keys of "casting".
- Read a row's casting cells in strict left-to-right order, mapping the Nth cell to the Nth role column. These boards repeat the same few names down every column, so a cell whose name differs from the rows above and below it is almost always a real one-off cast substitution: keep that name in its own column and never let it overwrite or displace the neighbouring columns (a real observed bug: a row whose "래리 머피" cell held a substitute actor put that same actor into the neighbouring "신시아 머피" column too, inventing a casting that was never printed).
- A role/cell sometimes lists more than one actor for the same performance -- most often an ensemble role (e.g. "목소리들") where several performers share the same role at once, as opposed to a lead role that simply rotates between actors on different dates. When that happens, list every one of those actors as separate entries in that role's array rather than joining them into one name or picking just one.
- The header row can also print the exact same role text in two or more separate columns instead of listing several names in one cell (e.g. two side-by-side columns both labeled "한유진", each with its own single actor name per row, because two different performers share that name in the same performance). Treat this exactly like the ensemble case above -- merge those columns into that one role's array, in left-to-right column order, rather than inventing a distinct key for the second column or dropping one of them.
- Some boards instead show a cast legend once (actor photo/name paired with a role name, e.g. "김지훈 - 빅터 프랑켄슈타인") separate from the schedule rows, and each row just lists actor names in a fixed order with no role labels. In that case, match each name in a row to a role by its position in the legend's order, and use the legend's role names as the keys of "casting".
- Omit a cell from "casting" when it is empty or a placeholder such as "-".
- If no casting table exists, return an empty performances array.
- If multiple tables exist, use only the largest and most complete one.
- Separately, scan every row in the table (not just a sample) for an inline badge next to or on that row, such as "Preview"/"프리뷰", "막공", or a curtain-call marker, and add one "dateTags" entry per badge occurrence, with "startDate" and "endDate" both set to that row's date. When a date has more than one performance time, check each row on that date individually rather than assuming the badge covers all of them -- if the badge is printed on only one of those rows, set "time" to that row's HH:mm so it does not get misapplied to the date's other performances (a real observed bug: a "첫공" badge printed only on a date's 16:00 row was wrongly applied to that same date's unrelated 20:00 show too). Leave "time" as "" when the badge is printed once for the whole date rather than repeated per row, or when that date only has a single performance. This is a distinct pass from building "performances": go row by row in order, since it is easy to skip one in a long list, especially when neighboring rows look visually identical. Do not skip a row just because nearby rows already got the same tag.
- Some boards instead mark a whole run of dates at once, e.g. a colored label in the margin spanning several rows (such as "더블적립위크" or "장면시연위크" covering a week). Add a single "dateTags" entry for the whole run: "startDate" is the first date the label covers and "endDate" is the last. Do not expand a run into one entry per day.
- A single date can carry more than one badge at once (e.g. a closing performance that is also a curtain-call day). In that case, add a separate "dateTags" entry for each badge on that date, rather than picking just one.
- Fill "printedStartWeekday"/"printedEndWeekday" by copying the weekday the board prints next to that date. Never derive a weekday from the date; return "" when the board prints none there.
- Fill "confidence" with your honest confidence (0 to 1) in this row's own date/time/casting, independent of other rows. Lower it when: the text is blurry, cropped, or partially obscured; the date/time had to be guessed rather than read; the row lacks a header row so roles were matched by position/legend instead of printed labels; or a casting cell was ambiguous between two similar names. A clean, fully legible row should be close to 1.

Event rules:
- An event/perk notice describes a promotion tied to a date or date range (e.g. a Polaroid giveaway, an autograph postcard giveaway, an opening-week event), not a cast.
- A line stating that something will NOT happen is not an event but a note about its absence (e.g. "스페셜 커튼콜 주차에는 에필로그 장면은 진행되지 않습니다"). Skip it, even when it names a date range. (This is different from an entire performance being cancelled or a previously-announced event being called off entirely -- those belong in the cancellation/change notice category above, not here.)
- A staged segment that an audience member would plan around IS an event, including one that rotates by period (e.g. "Epilogue 1 - 어부와 작가" one week, a different one the next). Extract each period as its own entry.
- Extract its Korean title, an optional longer description, and the date range it runs in "periodStart"/"periodEnd" (use the same date for both when it runs a single day).
- When the notice names a specific, discrete set of date+times the event applies to -- whether laid out as a table with one row per date+time (e.g. a 무대인사/커튼콜 schedule listing several rounds) or written as prose listing a few dates (e.g. "9월 22일(화) 20:00, 9월 29일(화) 20:00") -- read every one before deciding the range: set "periodStart" to the earliest date among them and "periodEnd" to the latest, not just the first one you see. Prefer a separately printed period label (e.g. "진행기간") over inferring the range from the listed dates when both are present. Do not collapse a multi-date listing into a single date just because you are also skipping a per-row actor breakdown. Also list every one of those date+times in "listedSlots" -- this is required whenever the listed dates are not every performance from periodStart through periodEnd (e.g. only two specific dates within a longer run, or a table whose date range includes another same-day performance the table simply does not mention, like an afternoon show with no evening curtain call). "listedSlots" is how the system tells "only these exact dates" apart from "every date in the period", so leave it empty only when the event genuinely applies to every performance between periodStart and periodEnd.
- Fill "printedStartWeekday"/"printedEndWeekday" by copying the weekday the notice prints next to that date (e.g. "8/19(수) - 8/23(일)" -> "수" and "일"). Never derive a weekday from the date; return "" when the notice prints none there.
- If one image shows several distinct events (e.g. a calendar listing multiple weekly promotions), extract each as its own entry in "events".
- When the notice separately calls out specific performance date+times beyond the period range that this event also applies to (e.g. "10/5(월) 15:00, 18:30 회차 포함"), list each as a {date, time} pair in "includedSlots" instead of stretching "periodEnd" to cover it.
- When the notice separately excludes specific performance date+times from within the period range (e.g. "단, 10/2 20:00 회차 제외"), list each as a {date, time} pair in "excludedSlots".
- Keep any such inclusion/exclusion wording in "title" or "description" as printed -- do not remove it just because you also structured it into "includedSlots"/"excludedSlots".
- When the notice ties the event to specific performance times rather than every performance within the period (e.g. "9/12(토) 19시 회차에는 스페셜 커튼콜이 함께 진행됩니다" -- only the 19:00 show that day, not every show that day; or "4시&8시 회차에는 ~" naming two times on one day), list each such time in "exactTimes" as HH:mm. Leave "exactTimes" empty when the event applies to every performance within the period, same as most table-based notices do.
- Do NOT confuse this with a time printed right next to periodStart or periodEnd as part of the period label itself (e.g. "진행기간 | 9/5(토) 6시 – 9/6(일)", or "9/1(화) - 9/5(토) 2시"). That time marks a cutoff on just that one boundary date -- it says nothing about every date in the period sharing that time, so it never belongs in "exactTimes" (a real observed bug: reading "9/1(화) - 9/5(토) 2시" as exactTimes=["14:00"] wrongly matched only the one coincidental 14:00 show in the whole period and dropped every other date, when the notice's actual scope was "everything from 9/1 through the 9/5 14:00 show"). Instead, when such a time is printed next to periodStart, put it in "periodStartCutoffTime" (meaning: only from that time onward on periodStart's own date); when printed next to periodEnd, put it in "periodEndCutoffTime" (meaning: only up to and including that time on periodEnd's own date). Just copy the printed HH:mm as-is -- you do not need to know what other performances that date has; matching it against the real schedule happens separately. Leave both empty when no such boundary-attached time is printed.

Cancellation/change rules:
- "cancelledSlots": one entry per already-scheduled performance date+time that the notice says will not take place at all. Resolve the year using the run above, like casting board dates. Do not use this for a scene/segment inside a performance not happening -- only for the whole performance being cancelled.
- "castingChanges": one entry per {date, time, role, actor} where an already-scheduled performance's cast is being swapped. "role" is the character name, "actor" is the new actor's name. When several roles change for the same date+time, add one entry per role.
- "cancelledEvents": one entry per previously-announced perk/event that the notice says will no longer happen. Give its Korean title as printed/referenced, and your best-guess date range even if only approximately stated (use the same date for both when it ran a single day) -- this only needs to be good enough to match against what's already saved, not exact.
- These notices sometimes give only a rough or partial date (e.g. referring to "this weekend's performance"); make your best guess resolving against the run above, same as other rules.

Make your best guess for ambiguous text, but never invent a performance or event that is not visible.
Always fill in "reason" as described in its schema, whether parsing succeeded or not.
`;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const PLACEHOLDER_NAMES = new Set(["", "-", "–", "—", "미정", "n/a", "N/A"]);

const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ");

const ENGLISH_WEEKDAYS: Record<string, string> = {
  sun: "일",
  mon: "월",
  tue: "화",
  wed: "수",
  thu: "목",
  fri: "금",
  sat: "토",
};

export const toKoreanWeekday = (printed: string) => {
  const value = printed.trim();

  if (value.length === 0) return "";

  return (
    ENGLISH_WEEKDAYS[value.slice(0, 3).toLowerCase()] ??
    value.replace(/요일$/, "")
  );
};

const agreesWithPrintedWeekday = (isoDate: string, printed: string) =>
  printed.length === 0 || getWeekday(isoDate) === toKoreanWeekday(printed);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const isNextDay = (date: string, next: string) =>
  Date.parse(`${next}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`) ===
  MS_PER_DAY;

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

// 다른 공연의 캐스팅표가 섞여있는 이미지를 이미지 단위로 골라낸다
function findCastMismatchImageIndexes(
  performances: ParsedPerformance[],
  show: ShowDetail,
): Set<number> {
  // 오픈런은 prfcast가 개막 당시 캐스팅이라 수년 지나면 지금 캐스팅과 안 겹칠 수 있어 대조 자체를 건너뛴다
  if (show.openrun === "Y") return new Set();

  const known = parseCastNames(show.prfcast);

  // 겹치는 이름이 하나도 없을 때 다른 공연의 캐스트로 판단
  if (known.size === 0) return new Set();

  const byImage = new Map<number, ParsedPerformance[]>();

  for (const performance of performances) {
    byImage.set(performance.imageIndex, [
      ...(byImage.get(performance.imageIndex) ?? []),
      performance,
    ]);
  }

  const mismatched = new Set<number>();

  for (const [imageIndex, group] of byImage) {
    const names = group.flatMap(({ casting }) => Object.values(casting).flat());

    if (!names.some((name) => known.has(normalizeName(name)))) {
      mismatched.add(imageIndex);
    }
  }

  return mismatched;
}

export function hasKnownCastOverlap(
  performances: ParsedPerformance[],
  show: ShowDetail,
) {
  return findCastMismatchImageIndexes(performances, show).size === 0;
}

function skipReason(
  performance: ParsedPerformance,
  date: string,
  time: string,
  casting: Record<string, string[]>,
  key: string,
  seen: Set<string>,
  from: string,
  to: string,
  imageCount: number,
): PerformanceSkipReason | null {
  if (!DATE_PATTERN.test(date)) return "invalid_date";
  if (!TIME_PATTERN.test(time)) return "invalid_time";
  if (date < from || date > to) return "out_of_range";
  if (getWeekday(date) !== toKoreanWeekday(performance.weekday ?? ""))
    return "weekday_mismatch";
  if (Object.keys(casting).length === 0) return "empty_casting";
  if (seen.has(key)) return "duplicate";

  if (
    !Number.isInteger(performance.imageIndex) ||
    performance.imageIndex < 0 ||
    performance.imageIndex >= imageCount
  ) {
    return "invalid_image_index";
  }

  return null;
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
  const skipped: SkippedPerformance[] = [];

  for (const performance of performances) {
    const date = performance.date?.trim() ?? "";
    const time = performance.time?.trim() ?? "";

    const casting = Object.fromEntries(
      Object.entries(performance.casting ?? {})
        .map(([role, actors]) => {
          // 스키마가 배열을 강제하지만, 모델이 한 배역에 배우 여럿을 콤마로
          // 이어붙여 문자열 하나로 반환하는 경우를 대비해 한 번 더 쪼갠다
          const names = [
            ...new Set(
              (Array.isArray(actors) ? actors : [actors]).flatMap((actor) =>
                splitActorNames(String(actor ?? "")),
              ),
            ),
          ].filter((name) => !PLACEHOLDER_NAMES.has(name.toLowerCase()));

          return [normalizeName(role), names] as const;
        })
        .filter(([role, names]) => role && names.length > 0),
    );

    const key = `${date} ${time}`;

    const reason = skipReason(
      performance,
      date,
      time,
      casting,
      key,
      seen,
      from,
      to,
      imageCount,
    );

    if (reason) {
      skipped.push({
        imageIndex: performance.imageIndex,
        raw: performance,
        reason,
      });
      continue;
    }

    seen.add(key);
    valid.push({
      date,
      time,
      weekday: performance.weekday,
      casting,
      imageIndex: performance.imageIndex,
      confidence: performance.confidence,
    });
  }

  const mismatchedImages = findCastMismatchImageIndexes(valid, show);

  // 완전히 걸러내지 않고 표시만 해서 검수 화면까지 보낸다 -- KOPIS prfcast는
  // 개막 시점 스냅샷이라 실제로는 맞는 캐스팅보드도 걸릴 수 있다
  const matched = valid.map((performance) =>
    mismatchedImages.has(performance.imageIndex)
      ? { ...performance, castMismatch: true }
      : performance,
  );

  return { performances: matched, skipped };
}

function mergeSameDateTags(dateTags: ParsedDateTag[]): ParsedDateTag[] {
  const groups = new Map<string, ParsedDateTag[]>();

  for (const dateTag of dateTags) {
    const group = groups.get(dateTag.tag) ?? [];

    group.push(dateTag);
    groups.set(dateTag.tag, group);
  }

  const merged: ParsedDateTag[] = [];

  for (const group of groups.values()) {
    merged.push(
      ...mergeWholeDayRuns(group.filter((dateTag) => dateTag.time === "")),
    );
    merged.push(
      ...mergePerSlotRuns(group.filter((dateTag) => dateTag.time !== "")),
    );
  }

  return merged;
}

function mergeWholeDayRuns(dateTags: ParsedDateTag[]): ParsedDateTag[] {
  if (dateTags.length === 0) return [];

  const merged: ParsedDateTag[] = [];

  const [first, ...rest] = dateTags.sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );

  let run = first;

  for (const dateTag of rest) {
    if (isNextDay(run.endDate, dateTag.startDate)) {
      run = {
        ...run,
        endDate: dateTag.endDate,
        printedEndWeekday: dateTag.printedEndWeekday,
      };
      continue;
    }

    merged.push(run);
    run = dateTag;
  }

  merged.push(run);

  return merged;
}

function mergePerSlotRuns(dateTags: ParsedDateTag[]): ParsedDateTag[] {
  if (dateTags.length === 0) return [];

  const merged: ParsedDateTag[] = [];

  const sorted = dateTags.sort(
    (a, b) =>
      a.startDate.localeCompare(b.startDate) || a.time.localeCompare(b.time),
  );

  let run = [sorted[0]];

  const flushRun = () => {
    const [runFirst] = run;

    if (run.length === 1) {
      merged.push(runFirst);
      return;
    }

    const runLast = run[run.length - 1];

    merged.push({
      ...runFirst,
      endDate: runLast.startDate,
      printedEndWeekday: runLast.printedStartWeekday,
      time: "",
      slots: run.map(({ startDate, time }) => ({ date: startDate, time })),
    });
  };

  for (const dateTag of sorted.slice(1)) {
    const runEndDate = run[run.length - 1].startDate;

    if (
      dateTag.startDate !== runEndDate &&
      !isNextDay(runEndDate, dateTag.startDate)
    ) {
      flushRun();
      run = [dateTag];
      continue;
    }

    run.push(dateTag);
  }

  flushRun();

  return merged;
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
    const time = dateTag.time?.trim() ?? "";

    const key = `${startDate}~${endDate}::${tag}::${time}`;

    const isValid =
      tag.length > 0 &&
      DATE_PATTERN.test(startDate) &&
      DATE_PATTERN.test(endDate) &&
      startDate <= endDate &&
      startDate >= from &&
      endDate <= to &&
      agreesWithPrintedWeekday(startDate, printedStartWeekday) &&
      agreesWithPrintedWeekday(endDate, printedEndWeekday) &&
      // 회차 하나에만 붙은 배지는 그 회차가 실제로 있어야 하고, 날짜 범위가 아니라 그 하루여야 한다
      (time === ""
        ? performances.some(({ date }) => date >= startDate && date <= endDate)
        : TIME_PATTERN.test(time) &&
          startDate === endDate &&
          performances.some(
            ({ date, time: pTime }) => date === startDate && pTime === time,
          )) &&
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
      time,
      imageIndex: dateTag.imageIndex,
    });
  }

  return mergeSameDateTags(valid);
}

const eventMatchJsonSchema = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          incomingIndex: {
            type: "integer",
            description: "0-based index into the incoming list.",
          },
          savedId: {
            type: "integer",
            description:
              "The #id of the saved entry it names the same event as.",
          },
        },
        required: ["incomingIndex", "savedId"],
      },
    },
  },
  required: ["matches"],
} satisfies z.core.JSONSchema.JSONSchema;

const eventMatchSchema = z.fromJSONSchema(eventMatchJsonSchema);

const describeEvent = ({
  title,
  periodStart,
  periodEnd,
}: {
  title: string;
  periodStart: string;
  periodEnd: string;
}) => `"${title}" ${periodStart} ~ ${periodEnd}`;

const buildEventMatchPrompt = (incoming: string[], saved: string[]) => `
Two lists of perks/events from one stage production are given.

Incoming (just read from an uploaded image):
${incoming.join("\n")}

Already saved:
${saved.join("\n")}

For each incoming entry, decide whether it names the same real-world event as one of the saved entries.
- One event is often worded differently depending on where it was printed -- a casting board margin label, an event calendar, a schedule notice. "스페셜커튼콜위크", "스페셜 커튼콜 위크" and "스페셜 커튼콜 주차" are one event.
- The two sources often disagree on the exact dates by a day or two. That alone does not make them different events.
- Unrelated events frequently run in overlapping periods (e.g. a giveaway week and a signing session inside it). Do not match those.
- List only the pairs you judge to be the same event, and leave an incoming entry out when none of the saved entries matches it.
`;

async function suggestSameEvents(
  incoming: PendingEvent[],
  saved: ExistingEvent[],
) {
  const client = new GoogleGenAI({});

  const interaction = await client.interactions.create({
    model: MODEL,
    input: [
      {
        type: "text",
        text: buildEventMatchPrompt(
          incoming.map((event, index) => `${index}. ${describeEvent(event)}`),
          saved.map((event) => `#${event.id} ${describeEvent(event)}`),
        ),
      },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: eventMatchJsonSchema,
    },
  });

  if (!interaction.output_text) throw new Error("Gemini가 응답하지 않았습니다");

  const { matches } = eventMatchSchema.parse(
    JSON.parse(interaction.output_text),
  ) as { matches: { incomingIndex: number; savedId: number }[] };

  return new Map(
    matches.map(({ incomingIndex, savedId }) => [incomingIndex, savedId]),
  );
}

export async function attachSuggestedDuplicates(pending: PendingEvent[]) {
  const saved = [
    ...new Map(
      pending.flatMap(({ overlapping }) =>
        overlapping.map((event) => [event.id, event] as const),
      ),
    ).values(),
  ];

  if (saved.length === 0) return pending;

  let suggested: Map<number, number>;

  try {
    suggested = await suggestSameEvents(pending, saved);
  } catch (error) {
    console.error("이벤트 중복 판정 실패", error);

    return pending;
  }

  return pending.map((event, index) => {
    const savedId = suggested.get(index);
    const match = event.overlapping.find(({ id }) => id === savedId);

    if (!match) return event;

    return { ...event, suggestedSameAsGroupId: match.groupId };
  });
}

export function unverifiedPoints(event: {
  source: EventSource;
  periodStart: string;
  periodEnd: string;
  printedStartWeekday: string;
  printedEndWeekday: string;
  includedSlots?: EventSlotException[];
  excludedSlots?: EventSlotException[];
  exactTimes?: string[];
  listedSlots?: EventSlotException[];
  periodStartCutoffTime?: string;
  periodEndCutoffTime?: string;
}): EventConfirmReason[] {
  const reasons: EventConfirmReason[] = [];

  if (event.source === "badge" && event.periodStart !== event.periodEnd) {
    reasons.push("range_badge");
  }

  if (!event.printedStartWeekday || !event.printedEndWeekday) {
    reasons.push("no_printed_weekday");
  }

  if (
    event.includedSlots?.length ||
    event.excludedSlots?.length ||
    event.listedSlots?.length ||
    event.periodStartCutoffTime ||
    event.periodEndCutoffTime
  ) {
    reasons.push("has_slot_exceptions");
  }

  if (event.exactTimes?.length) {
    reasons.push("has_specific_times");
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
      includedSlots,
      excludedSlots,
      exactTimes,
      listedSlots,
      periodStartCutoffTime,
      periodEndCutoffTime,
    }) => ({
      title,
      description,
      periodStart,
      periodEnd,
      printedStartWeekday,
      printedEndWeekday,
      imageIndex,
      includedSlots,
      excludedSlots,
      exactTimes,
      listedSlots,
      periodStartCutoffTime,
      periodEndCutoffTime,
      source: "notice" as const,
    }),
  );

  const fromBadges = dateTags.map(
    ({ tag, startDate, endDate, time, slots, ...dateTag }) => ({
      ...dateTag,
      title: tag,
      periodStart: startDate,
      periodEnd: endDate,
      // 회차 하나에만 붙은 배지는 그 회차에만 적용되게 exactTimes로 좁힌다
      exactTimes: !slots && time ? [time] : undefined,
      listedSlots: slots,
      source: "badge" as const,
    }),
  );

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
  group_id: number;
}): ExistingEvent => ({
  id: row.id,
  title: row.title,
  periodStart: row.period_start,
  periodEnd: row.period_end,
  source: row.source,
  edited: row.edited,
  groupId: row.group_id,
});

export async function attachOverlappingEvents(
  showId: string,
  pending: PendingEvent[],
): Promise<PendingEvent[]> {
  if (pending.length === 0) return pending;

  const from = pending.map(({ periodStart }) => periodStart).sort()[0];
  const to = pending
    .map(({ periodEnd }) => periodEnd)
    .sort()
    .at(-1)!;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("current_events")
    .select("id, title, period_start, group_id, period_end, source, edited")
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

// 첫공/막공처럼 특정 회차에만 적용되어야하는데 해당 날짜의 전체 회차에 적용되므로 사용자 확인을 받도록함 
export async function attachAmbiguousBadgeFlags(
  showId: string,
  pending: PendingEvent[],
): Promise<PendingEvent[]> {
  const ambiguousCandidates = pending.filter(
    (event) =>
      event.source === "badge" &&
      event.periodStart === event.periodEnd &&
      !event.exactTimes?.length &&
      !event.listedSlots?.length,
  );

  if (ambiguousCandidates.length === 0) return pending;

  const admin = createAdminClient();

  const { data: slots, error } = await admin
    .from("slots")
    .select("date")
    .eq("show_id", showId)
    .in(
      "date",
      [...new Set(ambiguousCandidates.map(({ periodStart }) => periodStart))],
    )
    .is("cancelled_at", null);

  if (error) throw error;

  const countByDate = new Map<string, number>();

  for (const { date } of slots) {
    countByDate.set(date, (countByDate.get(date) ?? 0) + 1);
  }

  return pending.map((event) => {
    if (!ambiguousCandidates.includes(event)) return event;
    if ((countByDate.get(event.periodStart) ?? 0) <= 1) return event;

    return {
      ...event,
      confirmReasons: [
        ...event.confirmReasons,
        "ambiguous_badge_time" as const,
      ],
    };
  });
}

const sanitizeSlotExceptions = (
  slots: EventSlotException[] | undefined,
): EventSlotException[] | undefined => {
  if (!slots) return undefined;

  const cleaned = slots.filter(
    ({ date, time }) => DATE_PATTERN.test(date) && TIME_PATTERN.test(time),
  );

  return cleaned.length > 0 ? cleaned : undefined;
};

const sanitizeExactTimes = (
  times: string[] | undefined,
): string[] | undefined => {
  if (!times) return undefined;

  const cleaned = [...new Set(times.filter((time) => TIME_PATTERN.test(time)))];

  return cleaned.length > 0 ? cleaned : undefined;
};

const sanitizeCutoffTime = (time: string | undefined): string | undefined => {
  const trimmed = time?.trim() ?? "";

  return TIME_PATTERN.test(trimmed) ? trimmed : undefined;
};

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
      description,
      periodStart,
      periodEnd,
      printedStartWeekday,
      printedEndWeekday,
      imageIndex: event.imageIndex,
      includedSlots: sanitizeSlotExceptions(event.includedSlots),
      excludedSlots: sanitizeSlotExceptions(event.excludedSlots),
      exactTimes: sanitizeExactTimes(event.exactTimes),
      listedSlots: sanitizeSlotExceptions(event.listedSlots),
      periodStartCutoffTime: sanitizeCutoffTime(event.periodStartCutoffTime),
      periodEndCutoffTime: sanitizeCutoffTime(event.periodEndCutoffTime),
    });
  }

  return valid;
}

function normalizeCancelledSlots(
  slots: ParsedCancelledSlot[],
  show: ShowDetail,
  imageCount: number,
) {
  const { from, to } = resolveRunWindow(show);

  const seen = new Set<string>();
  const valid: ParsedCancelledSlot[] = [];

  for (const slot of slots) {
    const date = slot.date?.trim() ?? "";
    const time = slot.time?.trim() ?? "";
    const key = `${date} ${time}`;

    const isValid =
      DATE_PATTERN.test(date) &&
      TIME_PATTERN.test(time) &&
      date >= from &&
      date <= to &&
      !seen.has(key) &&
      Number.isInteger(slot.imageIndex) &&
      slot.imageIndex >= 0 &&
      slot.imageIndex < imageCount;

    if (!isValid) continue;

    seen.add(key);
    valid.push({ date, time, imageIndex: slot.imageIndex });
  }

  return valid;
}

// Gemini 응답의 값을 보장하기 위해 여기서 한 번 더 거른다
function normalizeCastingChanges(
  changes: ParsedCastingChange[],
  show: ShowDetail,
  imageCount: number,
) {
  const { from, to } = resolveRunWindow(show);

  const seen = new Set<string>();
  const valid: ParsedCastingChange[] = [];

  for (const change of changes) {
    const date = change.date?.trim() ?? "";
    const time = change.time?.trim() ?? "";
    const role = normalizeName(change.role ?? "");
    const actor = normalizeActorName(change.actor ?? "");
    const key = `${date} ${time} ${role}`;

    const isValid =
      DATE_PATTERN.test(date) &&
      TIME_PATTERN.test(time) &&
      date >= from &&
      date <= to &&
      role.length > 0 &&
      actor.length > 0 &&
      !PLACEHOLDER_NAMES.has(actor.toLowerCase()) &&
      !seen.has(key) &&
      Number.isInteger(change.imageIndex) &&
      change.imageIndex >= 0 &&
      change.imageIndex < imageCount;

    if (!isValid) continue;

    seen.add(key);
    valid.push({ date, time, role, actor, imageIndex: change.imageIndex });
  }

  return valid;
}

// Gemini 응답의 값을 보장하기 위해 여기서 한 번 더 거른다
function normalizeCancelledEvents(
  events: ParsedCancelledEvent[],
  show: ShowDetail,
  imageCount: number,
) {
  const { from, to } = resolveRunWindow(show);

  const valid: ParsedCancelledEvent[] = [];

  for (const event of events) {
    const title = event.title?.trim() ?? "";
    const periodStart = event.periodStart?.trim() ?? "";
    const periodEnd = event.periodEnd?.trim() ?? "";

    const isValid =
      title.length > 0 &&
      DATE_PATTERN.test(periodStart) &&
      DATE_PATTERN.test(periodEnd) &&
      periodStart <= periodEnd &&
      periodStart <= to &&
      periodEnd >= from &&
      Number.isInteger(event.imageIndex) &&
      event.imageIndex >= 0 &&
      event.imageIndex < imageCount;

    if (!isValid) continue;

    valid.push({ title, periodStart, periodEnd, imageIndex: event.imageIndex });
  }

  return valid;
}

const eventGroupJsonSchema = {
  type: "object",
  properties: {
    groups: {
      type: "array",
      items: {
        type: "array",
        items: { type: "integer" },
      },
      description:
        'Each inner array lists the indices (into the given list) that all refer to the same real-world event. Only include a group when it has 2 or more indices -- leave every other index out of "groups" entirely.',
    },
  },
  required: ["groups"],
} satisfies z.core.JSONSchema.JSONSchema;

const eventGroupSchema = z.fromJSONSchema(eventGroupJsonSchema);

const buildEventGroupPrompt = (entries: string[]) => `
A list of perks/events read from one stage production's promotional images is given. The same real-world event sometimes shows up more than once in this list -- e.g. once from a weekly calendar image and again from a separate text notice about it, worded differently or with an unrelated event's name accidentally bundled in.

${entries.join("\n")}

Group the indices that name the same real-world event together.
- One event is often worded differently depending on where it was printed. "럭키드로우 위크 (9/24(목) 2시 회차 제외)" and "럭키드로우 위크 (단, 9/24(목) 2시 회차 제외)(삶과 죽음의 경계선 DAY)" are the same event even though the second string has another event's name tacked on.
- The two sources often disagree on the exact dates by a day or two. That alone does not make them different events.
- Unrelated events frequently run in overlapping periods (e.g. a giveaway week and a signing session inside it). Do not group those together.
`;

async function groupSameEvents(events: ParsedEvent[]): Promise<number[][]> {
  const client = new GoogleGenAI({});

  const interaction = await client.interactions.create({
    model: MODEL,
    input: [
      {
        type: "text",
        text: buildEventGroupPrompt(
          events.map((event, index) => `${index}. ${describeEvent(event)}`),
        ),
      },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: eventGroupJsonSchema,
    },
  });

  if (!interaction.output_text) throw new Error("Gemini가 응답하지 않았습니다");

  const { groups } = eventGroupSchema.parse(
    JSON.parse(interaction.output_text),
  ) as { groups: number[][] };

  return groups;
}

// 같은 업로드에서 여러 이미지가 같은 이벤트를 중복으로 담고 있을 때(예: 겹치게 캡처한 캘린더, 캘린더+추가 공지) 하나로 합친다
async function dedupeEvents(events: ParsedEvent[]): Promise<ParsedEvent[]> {
  const exact = new Map<string, ParsedEvent>();

  for (const event of events) {
    const key = `${normalizeName(event.title).toLowerCase()}|${event.periodStart}|${event.periodEnd}`;

    if (!exact.has(key)) exact.set(key, event);
  }

  const deduped = [...exact.values()];

  if (deduped.length < 2) return deduped;

  let groups: number[][];

  try {
    groups = await groupSameEvents(deduped);
  } catch (error) {
    console.error("이벤트 자체 중복 판정 실패", error);

    return deduped;
  }

  // 그룹마다 첫 번째 인덱스만 남기고 나머지는 중복으로 버린다
  const dropIndexes = new Set(groups.flatMap(([, ...rest]) => rest));

  return deduped.filter((_, index) => !dropIndexes.has(index));
}

function describeGeminiError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;

  while (current instanceof Error) {
    const code = (current as { code?: unknown }).code;

    parts.push(
      `${current.name}: ${current.message}${code ? ` (code=${String(code)})` : ""}`,
    );
    current = current.cause;
  }

  return parts.length > 0 ? parts.join(" <- caused by <- ") : String(error);
}

async function resizeCastingImage(buffer: Buffer) {
  return sharp(buffer)
    .resize({
      width: GEMINI_IMAGE_MAX_WIDTH,
      height: GEMINI_IMAGE_MAX_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();
}

function shouldCreateCastingBoardOverview(images: PreparedCastingImage[]) {
  if (images.length < 2) return false;

  const widths = images.map(({ width }) => width).filter((width) => width > 0);
  const heights = images
    .map(({ height }) => height)
    .filter((height) => height > 0);

  if (widths.length !== images.length || heights.length !== images.length) {
    return false;
  }

  const maxWidth = Math.max(...widths);
  const minWidth = Math.min(...widths);

  if (maxWidth === 0 || minWidth / maxWidth < 0.85) return false;

  const tallImages = images.filter(
    ({ width, height }) => height / width >= 1.15,
  );

  return tallImages.length >= 2;
}

async function createCastingBoardOverview(
  images: PreparedCastingImage[],
): Promise<GeminiImageBlock | null> {
  if (!shouldCreateCastingBoardOverview(images)) return null;

  const canvasWidth = Math.max(...images.map(({ width }) => width));
  const canvasHeight =
    images.reduce((sum, { height }) => sum + height, 0) +
    CASTING_OVERVIEW_SEPARATOR * (images.length - 1);
  const composites: sharp.OverlayOptions[] = [];
  let top = 0;

  for (const image of images) {
    composites.push({
      input: image.buffer,
      top,
      left: 0,
    });

    top += image.height + CASTING_OVERVIEW_SEPARATOR;
  }

  const overview = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: CASTING_OVERVIEW_BACKGROUND,
    },
  })
    .composite(composites)
    .jpeg({ quality: 80 })
    .toBuffer();

  const resized = await resizeCastingImage(overview);

  console.log(
    `[gemini] 연속 캡처 overview 추가 ${overview.byteLength}B -> ${resized.byteLength}B`,
  );

  return {
    type: "image",
    data: resized.toString("base64"),
    mime_type: "image/jpeg",
  };
}

async function buildCastingImageBlocks(images: Blob[]): Promise<GeminiImageBlock[]> {
  const prepared = await Promise.all(
    images.map(async (image, index) => {
      const buffer = Buffer.from(await image.arrayBuffer());
      const metadata = await sharp(buffer).metadata();

      return {
        index,
        buffer,
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
      } satisfies PreparedCastingImage;
    }),
  );

  const baseBlocks = await Promise.all(
    prepared.map(async ({ buffer, index }) => {
      const resized = await resizeCastingImage(buffer);

      console.log(
        `[gemini] 이미지 ${index} 리사이즈 ${buffer.byteLength}B -> ${resized.byteLength}B`,
      );

      return {
        type: "image",
        data: resized.toString("base64"),
        mime_type: "image/jpeg",
      } satisfies GeminiImageBlock;
    }),
  );

  const overviewBlock = await createCastingBoardOverview(prepared);

  return overviewBlock ? [...baseBlocks, overviewBlock] : baseBlocks;
}

const CONSENSUS_RUNS = 3;
const CONSENSUS_THRESHOLD = 2;
const CONSENSUS_DEADLINE_MS = 48_000;

const performanceSlotKey = ({
  date,
  time,
}: Pick<ParsedPerformance, "date" | "time">) => `${date} ${time}`;

const serializeCastingValue = (actors: string[]) => [...actors].sort().join("\u0000");

function pickMostCommonValue<T>(
  values: T[],
  toKey: (value: T) => string = (value) => JSON.stringify(value),
) {
  const counts = new Map<string, { count: number; value: T }>();

  for (const value of values) {
    const key = toKey(value);
    const current = counts.get(key);

    if (current) current.count += 1;
    else counts.set(key, { count: 1, value });
  }

  return [...counts.values()].sort((a, b) => b.count - a.count)[0] ?? null;
}

function buildConsensusPerformances(
  runs: ParsedPerformance[][],
  threshold: number,
): ParsedPerformance[] {
  const bySlot = new Map<string, ParsedPerformance[]>();

  for (const run of runs) {
    for (const performance of run) {
      const key = performanceSlotKey(performance);
      const current = bySlot.get(key) ?? [];

      current.push(performance);
      bySlot.set(key, current);
    }
  }

  const voted: ParsedPerformance[] = [];

  for (const performances of bySlot.values()) {
    const representative = performances[0];
    const roleNames = new Set(
      performances.flatMap(({ casting }) => Object.keys(casting)),
    );
    const casting: Record<string, string[]> = {};
    const unsureRoles: string[] = [];

    for (const role of roleNames) {
      const votes = performances
        .map((performance) => performance.casting[role])
        .filter((actors): actors is string[] => Array.isArray(actors));
      const best = pickMostCommonValue(votes, serializeCastingValue);

      if (best && best.count >= threshold) {
        casting[role] = [...best.value];
      } else {
        unsureRoles.push(role);
      }
    }

    const weekdayVote = pickMostCommonValue(
      performances
        .map(({ weekday }) => weekday.trim())
        .filter((weekday) => weekday.length > 0),
      (value) => value,
    );
    const imageIndexVote = pickMostCommonValue(
      performances.map(({ imageIndex }) => imageIndex),
      (value) => String(value),
    );
    const confidenceValues = performances.map(({ confidence }) => confidence);
    const confidence =
      confidenceValues.length > 0
        ? Math.max(...confidenceValues)
        : representative.confidence;
    const castMismatch = performances.some(
      (performance) => performance.castMismatch,
    );

    voted.push({
      date: representative.date,
      time: representative.time,
      weekday: weekdayVote?.value ?? representative.weekday,
      casting,
      imageIndex: imageIndexVote?.value ?? representative.imageIndex,
      confidence,
      castMismatch: castMismatch || undefined,
      unsureRoles: unsureRoles.length > 0 ? unsureRoles.sort() : undefined,
    });
  }

  return voted.sort((a, b) =>
    a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
  );
}

export async function parseCastingBoardWithConsensus(
  images: Blob[],
  show: ShowDetail,
  {
    model = VISION_MODEL,
    runs = CONSENSUS_RUNS,
    threshold = CONSENSUS_THRESHOLD,
    deadlineMs = CONSENSUS_DEADLINE_MS,
    budgetMs,
  }: ParseCastingBoardOptions & {
    runs?: number;
    threshold?: number;
    deadlineMs?: number;
  } = {},
): Promise<ParsedCastingBoardResult> {
  const startedAt = performance.now();

  const attempts = Array.from({ length: runs }, async (_, index) => {
    const remaining = Math.max(1, Math.round(deadlineMs - (performance.now() - startedAt)));
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), remaining);

    try {
      const result = await parseCastingBoard(images, show, {
        model,
        budgetMs,
        abortSignal: abortController.signal,
      });

      console.log(
        `[gemini-consensus] run ${index + 1}/${runs} completed in ${Math.round(
          performance.now() - startedAt,
        )}ms`,
      );

      return result;
    } finally {
      clearTimeout(timeout);
    }
  });

  const settled = await Promise.allSettled(attempts);
  const successful = settled.flatMap((result, index) =>
    result.status === "fulfilled" ? [{ index, value: result.value }] : [],
  );

  if (successful.length === 0) {
    const firstError = settled.find((result) => result.status === "rejected");

    throw firstError?.status === "rejected"
      ? firstError.reason
      : new Error("Consensus parsing failed");
  }

  const base = successful[0].value;

  if (successful.length === 1) {
    return base;
  }

  const effectiveThreshold = Math.min(threshold, successful.length);
  const performances = buildConsensusPerformances(
    successful.map(({ value }) => value.performances),
    effectiveThreshold,
  );

  console.log(
    `[gemini-consensus] ${successful.length}/${runs} runs succeeded, threshold=${effectiveThreshold}, performances=${performances.length}`,
  );

  return {
    ...base,
    performances,
  };
}

export async function parseCastingBoard(
  images: Blob[],
  show: ShowDetail,
  {
    model = VISION_MODEL,
    budgetMs,
    abortSignal,
  }: ParseCastingBoardOptions = {},
): Promise<ParsedCastingBoardResult> {
  const resizeStart = performance.now();

  const imageBlocks = await buildCastingImageBlocks(images);

  console.log(
    `[gemini] 리사이즈 전체 ${Math.round(performance.now() - resizeStart)}ms`,
  );

  const client = new GoogleGenAI({});

  const requestStart = performance.now();

  const GEMINI_BUDGET_MS = budgetMs ?? 55_000;
  const GEMINI_MIN_RETRY_MS = 10_000;
  const GEMINI_MAX_ATTEMPTS = 2;

  console.log(
    `[gemini] 요청 시작 (model=${model}, 이미지 ${imageBlocks.length}장)`,
  );

  let interaction: Awaited<
    ReturnType<typeof client.interactions.create>
  > | null = null;
  let lastError: unknown;

  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
    const remaining = Math.round(
      GEMINI_BUDGET_MS - (performance.now() - resizeStart),
    );

    if (attempt > 1 && remaining < GEMINI_MIN_RETRY_MS) {
      console.error(`[gemini] 남은 예산 ${remaining}ms이라 재시도를 건너뜁니다`);
      break;
    }

    const attemptStart = performance.now();

    try {
      interaction = await client.interactions.create(
        {
          model,
          input: [{ type: "text", text: buildPrompt(show) }, ...imageBlocks],
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: castingJsonSchema,
          },
        },
        {
          timeout_ms: Math.max(remaining, GEMINI_MIN_RETRY_MS),
          fetchOptions: abortSignal ? { signal: abortSignal } : undefined,
          retries: { strategy: "none" },
        },
      );

      console.log(
        `[gemini] 시도 ${attempt}/${GEMINI_MAX_ATTEMPTS} 성공 ${Math.round(performance.now() - attemptStart)}ms`,
      );

      break;
    } catch (error) {
      lastError = error;

      console.error(
        `[gemini] 시도 ${attempt}/${GEMINI_MAX_ATTEMPTS} 실패 ${Math.round(performance.now() - attemptStart)}ms ${describeGeminiError(error)}`,
      );
    }
  }

  if (!interaction) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Gemini 요청이 실패했습니다");
  }

  const status = "status" in interaction ? interaction.status : "stream";
  const outputText =
    "output_text" in interaction ? interaction.output_text : undefined;
  const usage = "usage" in interaction ? interaction.usage : undefined;

  console.log(
    `[gemini] 응답 수신 ${Math.round(performance.now() - requestStart)}ms status=${status} output_text=${outputText?.length ?? 0}자 input_tokens=${usage?.total_input_tokens ?? "?"} output_tokens=${usage?.total_output_tokens ?? "?"}`,
  );

  if (!outputText) {
    throw new Error("Gemini가 응답하지 않았습니다");
  }

  const parseStart = performance.now();

  let raw: unknown;

  try {
    raw = JSON.parse(outputText);
  } catch {
    console.error(outputText);

    throw new Error("Gemini가 JSON이 아닌 응답을 반환했습니다");
  }

  const parsed = castingSchema.parse(raw) as {
    performances: ParsedPerformance[];
    dateTags: ParsedDateTag[];
    events: ParsedEvent[];
    cancelledSlots: ParsedCancelledSlot[];
    castingChanges: ParsedCastingChange[];
    cancelledEvents: ParsedCancelledEvent[];
    reason: string;
  };

  console.log(
    `[gemini] JSON 파싱+검증 ${Math.round(performance.now() - parseStart)}ms (회차 ${parsed.performances.length}건, 이벤트 ${parsed.events.length}건)`,
  );

  const normalizeStart = performance.now();

  const { performances, skipped } = normalizePerformances(
    parsed.performances,
    show,
    imageBlocks.length,
  );

  const result = {
    performances,
    skipped,
    dateTags: normalizeDateTags(
      parsed.dateTags,
      show,
      imageBlocks.length,
      performances,
    ),
    events: await dedupeEvents(
      normalizeEvents(parsed.events, show, imageBlocks.length),
    ),
    cancelledSlots: normalizeCancelledSlots(
      parsed.cancelledSlots,
      show,
      imageBlocks.length,
    ),
    castingChanges: normalizeCastingChanges(
      parsed.castingChanges,
      show,
      imageBlocks.length,
    ),
    cancelledEvents: normalizeCancelledEvents(
      parsed.cancelledEvents,
      show,
      imageBlocks.length,
    ),
    reason: parsed.reason,
  };

  console.log(
    `[gemini] 정규화 ${Math.round(performance.now() - normalizeStart)}ms`,
  );

  return result;
}

const sha256 = (input: Buffer) =>
  createHash("sha256").update(input).digest("hex");

export async function hashImages(images: Blob[]): Promise<string[]> {
  return Promise.all(
    images.map(async (image) => sha256(Buffer.from(await image.arrayBuffer()))),
  );
}

async function hashStoragePaths(
  admin: ReturnType<typeof createAdminClient>,
  storagePaths: string[],
): Promise<string[]> {
  const downloads = await Promise.all(
    storagePaths.map((path) =>
      admin.storage.from(CASTING_BOARD_BUCKET).download(path),
    ),
  );

  if (downloads.some(({ data, error }) => error || !data)) {
    throw new Error("업로드된 이미지를 찾을 수 없어요.");
  }

  return hashImages(downloads.map(({ data }) => data!));
}

export type DuplicateReason = "reported" | "registered" | "picked_twice";

export async function findDuplicateReasons({
  admin,
  showId,
  hashes,
}: {
  admin: ReturnType<typeof createAdminClient>;
  showId: string;
  hashes: string[];
}): Promise<(DuplicateReason | null)[]> {
  const { data, error } = await admin
    .from("upload_images")
    .select("image_hash, upload_id")
    .eq("show_id", showId)
    .in("image_hash", hashes);

  if (error) throw error;

  const rows = data as { image_hash: string; upload_id: number }[];
  const reportedHashes = new Set<string>();
  const savedHashes = new Set(rows.map(({ image_hash }) => image_hash));

  if (rows.length > 0) {
    const { data: hidden, error: hiddenError } = await admin
      .from("hidden_castings")
      .select("upload_id")
      .in("upload_id", [...new Set(rows.map(({ upload_id }) => upload_id))]);

    if (hiddenError) throw hiddenError;

    const hiddenUploads = new Set(
      (hidden as { upload_id: number }[]).map(({ upload_id }) => upload_id),
    );

    for (const { image_hash, upload_id } of rows) {
      if (hiddenUploads.has(upload_id)) reportedHashes.add(image_hash);
    }
  }

  const seen = new Set<string>();

  return hashes.map((hash) => {
    if (reportedHashes.has(hash)) return "reported";
    if (savedHashes.has(hash)) return "registered";
    if (seen.has(hash)) return "picked_twice";

    seen.add(hash);

    return null;
  });
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

export const PARSE_FAILURE_RETENTION_DAYS = 7;

export async function purgeExpiredParseFailureImages(
  admin: ReturnType<typeof createAdminClient>,
) {
  const cutoff = new Date(
    Date.now() - PARSE_FAILURE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await admin
    .from("parse_failures")
    .select("id, storage_path")
    .is("image_purged_at", null)
    .lt("created_at", cutoff);

  if (error) throw error;

  const rows = data as { id: number; storage_path: string }[];

  if (rows.length === 0) return { purged: 0 };

  const storagePaths = [
    ...new Set(rows.map(({ storage_path }) => storage_path)),
  ];

  const { error: removeError } = await admin.storage
    .from(CASTING_BOARD_BUCKET)
    .remove(storagePaths);

  if (removeError) throw removeError;

  const { error: updateError } = await admin
    .from("parse_failures")
    .update({ image_purged_at: new Date().toISOString() })
    .in(
      "id",
      rows.map(({ id }) => id),
    );

  if (updateError) throw updateError;

  return { purged: rows.length };
}

type EventRow = {
  group_id: number;
  show_id: string;
  upload_id: number;
  upload_image_id: number;
  title: string;
  description: string | null;
  period_start: string;
  period_end: string;
  sparse_dates: boolean;
  source: EventSource;
  edited_by: string | null;
};

// PostgreSQL 에러 코드: unique_violation
const DUPLICATE_KEY = "23505";

async function createEventGroup(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from("event_groups")
    .insert({})
    .select("id")
    .single();

  if (error) throw error;

  return data.id as number;
}

async function insertEvent(
  admin: ReturnType<typeof createAdminClient>,
  row: EventRow,
) {
  const { error, data } = await admin
    .from("events")
    .insert(row)
    .select("id")
    .single();

  if (!error) return data.id;
  if (error.code !== DUPLICATE_KEY) throw error;

  const { data: existing, error: existingError } = await admin
    .from("events")
    .select("id")
    .eq("group_id", row.group_id)
    .eq("upload_id", row.upload_id)
    .eq("period_start", row.period_start)
    .eq("period_end", row.period_end)
    .maybeSingle();

  if (existingError) throw existingError;

  return existing?.id;
}

const slotKey = (date: string, time: string) => `${date} ${time.slice(0, 5)}`;

// 이벤트가 실제로 적용되는 회차 id 목록을 기간 + 막대 외 포함/제외 회차로 계산한다.
// 새로 저장할 때와 정정 제안으로 다시 계산할 때 모두 이 로직을 그대로 써야 한다
export async function computeEventSlotIds(
  admin: ReturnType<typeof createAdminClient>,
  showId: string,
  periodStart: string,
  periodEnd: string,
  includedSlots: EventSlotException[] = [],
  excludedSlots: EventSlotException[] = [],
  exactTimes?: string[],
  listedSlots: EventSlotException[] = [],
  periodStartCutoffTime?: string,
  periodEndCutoffTime?: string,
): Promise<number[]> {
  const { data: periodSlots, error: periodSlotsErr } = await admin
    .from("slots")
    .select("id, date, time")
    .eq("show_id", showId)
    .gte("date", periodStart)
    .lte("date", periodEnd)
    .is("cancelled_at", null);

  if (periodSlotsErr) throw periodSlotsErr;

  const excludedKeys = new Set(
    excludedSlots.map(({ date, time }) => slotKey(date, time)),
  );

  const exactTimeSet = exactTimes?.length
    ? new Set(exactTimes.map((time) => time.slice(0, 5)))
    : null;

  const listedKeys = listedSlots.length
    ? new Set(listedSlots.map(({ date, time }) => slotKey(date, time)))
    : null;

  const matchedSlotIds = new Set(
    periodSlots
      .filter(
        (slot) => !listedKeys || listedKeys.has(slotKey(slot.date, slot.time)),
      )
      .filter((slot) => !excludedKeys.has(slotKey(slot.date, slot.time)))
      .filter(
        (slot) => !exactTimeSet || exactTimeSet.has(slot.time.slice(0, 5)),
      )
      .filter(
        (slot) =>
          !periodStartCutoffTime ||
          slot.date !== periodStart ||
          slot.time.slice(0, 5) >= periodStartCutoffTime,
      )
      .filter(
        (slot) =>
          !periodEndCutoffTime ||
          slot.date !== periodEnd ||
          slot.time.slice(0, 5) <= periodEndCutoffTime,
      )
      .map(({ id }) => id),
  );

  if (includedSlots.length > 0) {
    const { data: extraSlots, error: extraSlotsErr } = await admin
      .from("slots")
      .select("id, date, time")
      .eq("show_id", showId)
      .in("date", [...new Set(includedSlots.map(({ date }) => date))])
      .is("cancelled_at", null);

    if (extraSlotsErr) throw extraSlotsErr;

    const includedKeys = new Set(
      includedSlots.map(({ date, time }) => slotKey(date, time)),
    );

    for (const slot of extraSlots) {
      if (includedKeys.has(slotKey(slot.date, slot.time))) {
        matchedSlotIds.add(slot.id);
      }
    }
  }

  return [...matchedSlotIds];
}

// 이미 등록된 회차를 취소 처리한다 (삭제하지 않고 cancelled_at만 채워 이력을 남긴다)
async function applyCancelledSlots(
  admin: ReturnType<typeof createAdminClient>,
  showId: string,
  cancelledSlots: ParsedCancelledSlot[],
): Promise<number> {
  let count = 0;

  for (const { date, time } of cancelledSlots) {
    const { error, count: updated } = await admin
      .from("slots")
      .update({ cancelled_at: new Date().toISOString() }, { count: "exact" })
      .eq("show_id", showId)
      .eq("date", date)
      .eq("time", time)
      .is("cancelled_at", null);

    if (error) throw error;

    count += updated ?? 0;
  }

  return count;
}

// 배역 하나에 배우가 여럿(앙상블)인 경우, 이 함수는 옛 배우를 특정하지 않고
// role_name_raw만으로 매칭해 그 배역의 모든 배우를 새 배우 한 명으로 덮어쓴다.
// castingChanges는 "배역 하나 = 배우 하나" 교체 공지만 다루므로 앙상블 배역
// 캐스팅 변경 공지는 대상이 아니다
async function applyCastingChanges(
  admin: ReturnType<typeof createAdminClient>,
  showId: string,
  castingChanges: ParsedCastingChange[],
): Promise<number> {
  let count = 0;

  for (const { date, time, role, actor } of castingChanges) {
    const { data: slot, error: slotError } = await admin
      .from("slots")
      .select("id")
      .eq("show_id", showId)
      .eq("date", date)
      .eq("time", time)
      .is("cancelled_at", null)
      .maybeSingle();

    if (slotError) throw slotError;
    if (!slot) continue;

    const { data: casting, error: castingError } = await admin
      .from("current_castings")
      .select("upload_id")
      .eq("slot_id", slot.id)
      .maybeSingle();

    if (castingError) throw castingError;
    if (!casting) continue;

    const { data: actorRow, error: actorError } = await admin
      .from("actors")
      .upsert([{ name: actor }], {
        onConflict: "name",
        ignoreDuplicates: false,
      })
      .select("id")
      .single();

    if (actorError) throw actorError;

    const { error: updateError, count: updated } = await admin
      .from("assignments")
      .update(
        { actor_name_raw: actor, actor_id: actorRow.id, verified: false },
        { count: "exact" },
      )
      .eq("upload_id", casting.upload_id)
      .eq("slot_id", slot.id)
      .eq("role_name_raw", role);

    if (updateError) throw updateError;

    count += updated ?? 0;
  }

  return count;
}

const PUNCT_PATTERN = /[!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~·・]/g;

// events.title_key 생성 규칙과 동일하게 공백/문장부호를 지운 키로 대조한다
const toTitleKey = (title: string) =>
  title.trim().toLowerCase().replace(/\s+/g, "").replace(PUNCT_PATTERN, "");

async function applyCancelledEvents(
  admin: ReturnType<typeof createAdminClient>,
  showId: string,
  cancelledEvents: ParsedCancelledEvent[],
): Promise<number> {
  if (cancelledEvents.length === 0) return 0;

  const from = cancelledEvents.map(({ periodStart }) => periodStart).sort()[0];
  const to = cancelledEvents
    .map(({ periodEnd }) => periodEnd)
    .sort()
    .at(-1)!;

  const { data, error } = await admin
    .from("current_events")
    .select("id, title_key, period_start, period_end")
    .eq("show_id", showId)
    .lte("period_start", to)
    .gte("period_end", from);

  if (error) throw error;

  const candidates = data as {
    id: number;
    title_key: string;
    period_start: string;
    period_end: string;
  }[];

  let count = 0;

  for (const cancelled of cancelledEvents) {
    const key = toTitleKey(cancelled.title);

    const match = candidates.find(
      (candidate) =>
        candidate.title_key === key &&
        candidate.period_start <= cancelled.periodEnd &&
        cancelled.periodStart <= candidate.period_end,
    );

    if (!match) continue;

    const { error: updateError, count: updated } = await admin
      .from("events")
      .update({ cancelled_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", match.id);

    if (updateError) throw updateError;

    count += updated ?? 0;
  }

  return count;
}

export async function saveCastingBoard({
  showId,
  userId,
  storagePaths,
  performances,
  events,
  skipped,
  cancelledSlots = [],
  castingChanges = [],
  cancelledEvents = [],
  source = "user",
}: {
  showId: string;
  userId: string;
  storagePaths: string[];
  performances: ParsedPerformance[];
  events: ConfirmedEvent[];
  skipped: SkippedPerformance[];
  cancelledSlots?: ParsedCancelledSlot[];
  castingChanges?: ParsedCastingChange[];
  cancelledEvents?: ParsedCancelledEvent[];
  source?: "user" | "system";
}): Promise<CastingBoardResult> {
  const admin = createAdminClient();

  const imageHashes = await hashStoragePaths(admin, storagePaths);

  const { data: upload, error: uploadError } = await admin
    .from("uploads")
    .insert({ show_id: showId, user_id: userId, source })
    .select("id")
    .single();

  if (uploadError) throw uploadError;

  try {
    return await saveCastingBoardContent({
      admin,
      showId,
      userId,
      storagePaths,
      imageHashes,
      performances,
      events,
      skipped,
      cancelledSlots,
      castingChanges,
      cancelledEvents,
      upload,
    });
  } catch (error) {
    const { error: cleanupError } = await admin
      .from("uploads")
      .delete()
      .eq("id", upload.id);

    if (cleanupError) console.error("업로드 정리 실패", cleanupError);

    throw error;
  }
}

async function saveCastingBoardContent({
  admin,
  showId,
  userId,
  storagePaths,
  imageHashes,
  performances,
  events,
  skipped,
  cancelledSlots,
  castingChanges,
  cancelledEvents,
  upload,
}: {
  admin: ReturnType<typeof createAdminClient>;
  showId: string;
  userId: string;
  storagePaths: string[];
  imageHashes: string[];
  performances: ParsedPerformance[];
  events: ConfirmedEvent[];
  skipped: SkippedPerformance[];
  cancelledSlots: ParsedCancelledSlot[];
  castingChanges: ParsedCastingChange[];
  cancelledEvents: ParsedCancelledEvent[];
  upload: { id: number };
}): Promise<CastingBoardResult> {
  const { data: uploadImages, error: uploadImagesError } = await admin
    .from("upload_images")
    .insert(
      storagePaths.map((storagePath, position) => ({
        upload_id: upload.id,
        show_id: showId,
        image_hash: imageHashes[position],
        storage_path: storagePath,
        position,
      })),
    )
    .select("id, position");

  if (uploadImagesError) {
    if (uploadImagesError.code === DUPLICATE_KEY)
      throw new Error("이미 등록된 캐스팅보드예요.");

    throw uploadImagesError;
  }

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
      ...new Set(
        performances.flatMap(({ casting }) => Object.values(casting).flat()),
      ),
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

        return Object.entries(casting).flatMap(([role, actors]) =>
          actors.map((actor) => ({
            upload_id: upload.id,
            slot_id: slotId,
            role_name_raw: role,
            actor_name_raw: actor,
            actor_id: actorIdByName.get(actor) ?? null,
            upload_image_id: uploadImageId,
          })),
        );
      },
    );

    const { error: assignmentError } = await admin
      .from("assignments")
      .upsert(assignments, {
        onConflict: "upload_id,slot_id,role_name_raw,actor_name_raw",
        ignoreDuplicates: true,
      });

    if (assignmentError) throw assignmentError;
  }

  let eventCount = 0;

  for (const event of events) {
    const uploadImageId = uploadImageIdByPosition.get(event.imageIndex);

    if (uploadImageId === undefined) continue;

    let groupId: number;

    if (
      event.replacesGroupId !== undefined &&
      event.overlapping.some(
        ({ groupId: candidateId }) => candidateId === event.replacesGroupId,
      )
    ) {
      groupId = event.replacesGroupId;
    } else {
      groupId = await createEventGroup(admin);
    }

    const row: EventRow = {
      group_id: groupId,
      show_id: showId,
      upload_id: upload.id,
      upload_image_id: uploadImageId,
      title: event.title,
      description: event.description ?? null,
      period_start: event.periodStart,
      period_end: event.periodEnd,
      sparse_dates: (event.listedSlots?.length ?? 0) > 0,
      source: event.source,
      edited_by: event.edited ? userId : null,
    };

    const eventId = await insertEvent(admin, row);

    if (eventId) {
      eventCount += 1;

      const matchedSlotIds = await computeEventSlotIds(
        admin,
        showId,
        event.periodStart,
        event.periodEnd,
        event.includedSlots,
        event.excludedSlots,
        event.exactTimes,
        event.listedSlots,
        event.periodStartCutoffTime,
        event.periodEndCutoffTime,
      );

      const eventSlots = matchedSlotIds.map((slotId) => ({
        event_id: eventId,
        slot_id: slotId,
      }));

      const { error: eventSlotsErr } = await admin
        .from("event_slots")
        .upsert(eventSlots, {
          onConflict: "event_id,slot_id",
          ignoreDuplicates: true,
        });

      if (eventSlotsErr) throw eventSlotsErr;
    }
  }

  const cancelledSlotCount = await applyCancelledSlots(
    admin,
    showId,
    cancelledSlots,
  );
  const castingChangeCount = await applyCastingChanges(
    admin,
    showId,
    castingChanges,
  );
  const cancelledEventCount = await applyCancelledEvents(
    admin,
    showId,
    cancelledEvents,
  );

  return {
    uploadId: upload.id,
    slotCount: performances.length,
    actorCount: actorNames.length,
    eventCount,
    skippedCount: skipped.length,
    skipped,
    cancelledSlotCount,
    castingChangeCount,
    cancelledEventCount,
  };
}
