export const MAX_ROWS_PER_REQUEST = 1000;

export async function selectAllRows<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = MAX_ROWS_PER_REQUEST,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(from, from + pageSize - 1);

    if (error) throw error;

    rows.push(...(data ?? []));

    if (!data || data.length < pageSize) return rows;
  }
}

export const chunkArray = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
