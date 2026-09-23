// JS의 .length는 UTF-16 단위라 🐰 하나가 2, 👩‍❤️‍💋‍👨 하나가 11로 세어진다
const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("ko", { granularity: "grapheme" })
    : null;

// Segmenter는 iOS 16.4 미만에 없다. 결합 이모지를 실제보다 길게 세는 쪽으로 틀린다
export const toGraphemes = (value: string): string[] =>
  segmenter
    ? [...segmenter.segment(value)].map(({ segment }) => segment)
    : [...value];

export const graphemeLength = (value: string) => toGraphemes(value).length;

export const truncateGraphemes = (value: string, max: number) =>
  toGraphemes(value).slice(0, max).join("");

export const firstGrapheme = (value: string) => toGraphemes(value)[0] ?? "";
