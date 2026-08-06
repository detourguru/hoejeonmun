import { XMLParser } from "fast-xml-parser";

export async function getKopis(
  path: string,
  params: URLSearchParams,
  revalidate?: boolean,
) {
  const baseUrl = process.env.NEXT_KOPIS_API_URL;
  const apiKey = process.env.KOPIS_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "KOPIS API URL or API Key is not defined in environment variables.",
    );
  }

  const response = await fetch(
    `${baseUrl}${path}?service=${apiKey}&${params.toString()}`,
    { next: { revalidate: revalidate ? 60 : 0 } },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch data from KOPIS API: ${response.statusText}`,
    );
  }

  const rawData = await response.text();
  const parsedData = new XMLParser().parse(rawData).dbs.db;
  const data = Array.isArray(parsedData) ? parsedData : [parsedData];

  return data;
}
