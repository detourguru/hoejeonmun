"use client";

import { useSearchParams } from "next/navigation";

import { useUpdateSearchParams } from "@/hook/useUpdateSearchParams";

export const ToggleChip = ({
  name,
  label,
}: {
  name: string;
  label: string;
}) => {
  const searchParams = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const checked = searchParams.get(name) === "1";

  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => updateSearchParams({ [name]: checked ? null : "1" })}
      className="border-border bg-surface text-text flex h-auto shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold"
    >
      {checked && <span className="bg-point size-1.5 shrink-0 rounded-full" />}
      {label}
    </button>
  );
};
