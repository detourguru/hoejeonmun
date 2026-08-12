import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useUpdateSearchParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (updates: Record<string, string | string[] | null | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());

    // 필터가 바뀌면 처음으로 되돌린다
    if (!("page" in updates)) params.delete("page");
    Object.entries(updates).forEach(([key, value]) => {
      if (value == null || value === "") {
        params.delete(key);
      } else {
        if (typeof value === "object") {
          value.forEach((val) => {
            params.append(key, val);
          });
        } else params.set(key, value);
      }
    });

    const query = params.toString();

    router.replace(query ? `${pathname}?${query}` : pathname);
  };
}
