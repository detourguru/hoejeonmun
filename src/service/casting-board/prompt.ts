import * as z from "zod";

import {
  ParsedCancelledEvent,
  ParsedCancelledSlot,
  ParsedCastingChange,
  ParsedDateTag,
  ParsedEvent,
  ParsedPerformance,
  SkippedPerformance,
} from "@/type/casting";
import { ShowDetail } from "@/type/show";

import { resolveRunWindow } from "./normalize";

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

export const castingSchema = z.fromJSONSchema(castingJsonSchema);

export const GEMINI_IMAGE_MAX_WIDTH = 1600;
export const GEMINI_IMAGE_MAX_HEIGHT = 3000;
export const CASTING_OVERVIEW_SEPARATOR = 16;
export const CASTING_OVERVIEW_BACKGROUND = "#ffffff";

export type GeminiImageBlock = {
  type: "image";
  data: string;
  mime_type: "image/jpeg";
};

export type PreparedCastingImage = {
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
- When a casting-table segment visibly prints its own role header, use that header for that segment and discard any earlier locked header. Even the same show's tables can rearrange role columns between pages, so never override a visible header with a header from another image.
- Only when an image has no visible role header, inherit the shared role-column order from another image if they are clearly adjacent parts of one continuous casting table. Confirm this from the same date/time and column geometry plus a plausible date sequence or page sequence; matching show branding, similar styling, or upload order alone is not enough.
- The locked header belongs only to that one continuous casting-table segment, never to the entire image or upload. Carry it forward only while the following rows preserve the same date/time columns and the same role-column count, order, and horizontal alignment.
- Stop applying the locked header as soon as a new title, separator, header/layout change, missing date/time column, or a table with non-role columns appears. In particular, never use a casting header to interpret a following event/perk table as casting merely because it has dates or actor names. Extract that separate table as an event instead.
- When multiple images are provided, you may also receive one extra stitched overview image that vertically combines them in upload order. Use that overview only as supporting visual context; it does not prove that images are consecutive, because uploads can be reordered or taken from separate carousels. Use the individual images for the exact text in each row.
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
- A plain national/calendar holiday label attached to a date on a casting board (e.g. "한글날", "개천절", "대체공휴일", "추석", "설날") is not an event by itself -- it is just calendar context for that date. Skip it, unless that same label is also tied to an actual promotion, perk, or schedule change described in the notice.
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
export const eventMatchJsonSchema = {
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

export const eventMatchSchema = z.fromJSONSchema(eventMatchJsonSchema);

export const describeEvent = ({
  title,
  periodStart,
  periodEnd,
}: {
  title: string;
  periodStart: string;
  periodEnd: string;
}) => `"${title}" ${periodStart} ~ ${periodEnd}`;

export const buildEventMatchPrompt = (incoming: string[], saved: string[]) => `
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
export const eventGroupJsonSchema = {
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

export const eventGroupSchema = z.fromJSONSchema(eventGroupJsonSchema);

export const buildEventGroupPrompt = (entries: string[]) => `
A list of perks/events read from one stage production's promotional images is given. The same real-world event sometimes shows up more than once in this list -- e.g. once from a weekly calendar image and again from a separate text notice about it, worded differently or with an unrelated event's name accidentally bundled in.

${entries.join("\n")}

Group the indices that name the same real-world event together.
- One event is often worded differently depending on where it was printed. "럭키드로우 위크 (9/24(목) 2시 회차 제외)" and "럭키드로우 위크 (단, 9/24(목) 2시 회차 제외)(삶과 죽음의 경계선 DAY)" are the same event even though the second string has another event's name tacked on.
- The two sources often disagree on the exact dates by a day or two. That alone does not make them different events.
- Unrelated events frequently run in overlapping periods (e.g. a giveaway week and a signing session inside it). Do not group those together.
`;
export function describeGeminiError(error: unknown): string {
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
