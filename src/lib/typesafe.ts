import "server-only";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";

type NoulQuestion = {
  type: "noul";
  instructions: string | Record<string, unknown>;
  criteria?: { true?: string; false?: string };
};

type NoulAnswer = { type: "noul"; noul: number };

export async function askNouls(
  state: unknown,
  questions: Record<string, NoulQuestion>,
  { signal }: { signal?: AbortSignal } = {},
): Promise<Record<string, number>> {
  const apiKey = process.env.JEV_API_KEY;

  if (!apiKey) throw new Error("JEV_API_KEY 환경 변수가 없어요.");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: JEV_MODEL, state, questions }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Jev 요청 실패 (${res.status}): ${await res.text()}`);
  }

  const { answers } = (await res.json()) as {
    answers: Record<string, NoulAnswer>;
  };

  return Object.fromEntries(
    Object.entries(answers).map(([key, answer]) => [key, answer.noul]),
  );
}
