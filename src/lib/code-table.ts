/**
 * KOPIS가 지원하는 API는 코드<>이름 쌍 공통코드를 제공하는데
 * 요청에는 코드를 받고 응답에는 이름을 주고있어 양쪽 변환을 용이하게 하기위한 헬퍼
 * {코드:이름}[]으로 정의하면 옵션/코드/이름/타입가드를 반환함
 * **/

export type CodeOption<TCode extends string, TName extends string> = {
  value: TCode;
  label: TName;
};

export type CodeTable<TCode extends string, TName extends string> = {
  options: readonly CodeOption<TCode, TName>[];
  codes: readonly TCode[];
  nameByCode: Record<TCode, TName>; // 코드로 이름을 가져온다
  isCode: (value: unknown) => value is TCode;
};

export type CodeOf<T> = T extends CodeTable<infer TCode, string> ? TCode : never;

export type NameOf<T> = T extends CodeTable<string, infer TName> ? TName : never;

export function createCodeTable<
  const TOptions extends readonly CodeOption<string, string>[],
>(
  options: TOptions,
): CodeTable<TOptions[number]["value"], TOptions[number]["label"]> {
  type TCode = TOptions[number]["value"];
  type TName = TOptions[number]["label"];

  const codes = options.map(({ value }) => value) as TCode[];

  return {
    options,
    codes,
    nameByCode: Object.fromEntries(
      options.map(({ value, label }) => [value, label]),
    ) as Record<TCode, TName>,
    isCode: (value): value is TCode => codes.includes(value as TCode),
  };
}
