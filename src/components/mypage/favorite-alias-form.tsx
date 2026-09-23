"use client";

import { useState, useTransition } from "react";

import { setFavoriteAlias } from "@/app/(main)/actor/actions";
import { graphemeLength, truncateGraphemes } from "@/lib/grapheme";
import { cn } from "@/lib/utils";

const MAX_ALIAS_LENGTH = 8;

export const FavoriteAliasForm = ({
  actorId,
  alias,
}: {
  actorId: number;
  alias: string | null;
}) => {
  const [saved, setSaved] = useState(alias);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(alias ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = () => {
    setValue(saved ?? "");
    setError(null);
    setEditing(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    startTransition(async () => {
      const result = await setFavoriteAlias(actorId, value);

      if (!result.ok) {
        setError(result.message);

        return;
      }

      setSaved(result.alias);
      setEditing(false);
    });
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={open}
        className="text-text-muted hover:text-primary relative z-10 w-fit text-[11px] underline underline-offset-2"
      >
        {saved ? `별칭 ${saved}` : "별칭 정하기"}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="relative z-10 flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(event) =>
            setValue(truncateGraphemes(event.target.value, MAX_ALIAS_LENGTH))
          }
          placeholder="이모지나 애칭"
          aria-label="애정배우 별칭"
          className="border-border text-text min-w-0 flex-1 rounded-md border px-2 py-1 text-xs"
        />

        <button
          type="submit"
          disabled={pending}
          className="bg-primary shrink-0 rounded-md px-2 py-1 text-xs text-white disabled:opacity-60"
        >
          저장
        </button>

        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-text-muted hover:text-text shrink-0 px-1 py-1 text-xs"
        >
          취소
        </button>
      </div>

      <p
        className={cn(
          "text-[10px]",
          error ? "text-red-600" : "text-text-muted",
        )}
      >
        {error ??
          `${graphemeLength(value)}/${MAX_ALIAS_LENGTH}자 · 비우고 저장하면 본명으로 돌아가요.`}
      </p>
    </form>
  );
};
