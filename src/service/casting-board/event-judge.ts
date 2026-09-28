import { askNouls } from "@/lib/typesafe";

type EventLike = { title: string; periodStart: string; periodEnd: string };

const DAY_MS = 24 * 60 * 60 * 1000;
const QUESTIONS_PER_REQUEST = 100;

const toDay = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS;

const NEAR_DAYS = 2;

export const SAME_EVENT_THRESHOLD = 0.6;

function isDateCandidate(a: EventLike, b: EventLike) {
  const overlaps = a.periodStart <= b.periodEnd && b.periodStart <= a.periodEnd;
  const maxGap = Math.max(
    Math.abs(toDay(a.periodStart) - toDay(b.periodStart)),
    Math.abs(toDay(a.periodEnd) - toDay(b.periodEnd)),
  );

  return overlaps && maxGap <= NEAR_DAYS;
}

const buildQuestion = (a: EventLike, b: EventLike) => ({
  type: "noul" as const,
  instructions: {
    a: a.title,
    b: b.title,
    question:
      "Do the perk/event titles `a` and `b`, announced for the same dates of one stage production, name the same real-world event?",
  },
  criteria: {
    true: "The same event, worded differently: spacing, word order, abbreviations, or synonyms such as 위크/주차 (e.g. 스페셜커튼콜위크 and 스페셜 커튼콜 주차).",
    false:
      "Different events, including unrelated perks that simply run during overlapping dates, such as a giveaway week and a signing session held inside it. Also different when one title adds a separate activity to the other: 막공 only marks an actor's closing performance, while 막공 무대인사 is a stage greeting held to celebrate it.",
  },
});

export async function judgeSameEventPairs(
  pairs: [EventLike, EventLike][],
): Promise<number[]> {
  const probabilities = pairs.map(() => 0);
  const asked = pairs
    .map((pair, index) => ({ pair, index }))
    .filter(({ pair: [a, b] }) => isDateCandidate(a, b));

  for (let offset = 0; offset < asked.length; offset += QUESTIONS_PER_REQUEST) {
    const chunk = asked.slice(offset, offset + QUESTIONS_PER_REQUEST);
    const answers = await askNouls(
      "Perk and event titles announced for one stage production (Korean musical/play).",
      Object.fromEntries(
        chunk.map(({ pair: [a, b] }, index) => [
          `pair_${index}`,
          buildQuestion(a, b),
        ]),
      ),
    );

    chunk.forEach(({ index }, position) => {
      probabilities[index] = answers[`pair_${position}`];
    });
  }

  return probabilities;
}
