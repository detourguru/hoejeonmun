"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setEventUrl } from "@/app/(main)/show/[id]/castings/actions";
import { createClient } from "@/lib/supabase/client";

export const EventUrlField = ({
  eventId,
  url: initial,
}: {
  eventId: number;
  url: string | null;
}) => {
  const router = useRouter();

  const [url, setUrl] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const startEdit = async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getClaims();

    if (!data?.claims?.sub) {
      const next = window.location.pathname + window.location.search;

      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    setDraft(url ?? "");
    setError(null);
    setEditing(true);
  };

  const save = () => {
    setError(null);

    startTransition(async () => {
      const result = await setEventUrl(eventId, draft);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setUrl(result.url);
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <div className="mt-1 flex flex-col gap-1">
        <input
          type="url"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="https://..."
          className="rounded border border-border bg-surface px-2 py-1 text-xs text-text"
        />

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="text-xs text-primary underline disabled:opacity-60"
          >
            저장
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={pending}
            className="text-xs text-text-muted underline"
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  return url ? (
    <div className="mt-1 flex items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-primary underline"
      >
        확인하러 가기 ↗
      </a>
      <button
        type="button"
        onClick={startEdit}
        className="text-xs text-text-muted underline"
      >
        수정
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={startEdit}
      className="mt-1 w-fit text-xs text-text-muted underline"
    >
      + 링크 추가
    </button>
  );
};
