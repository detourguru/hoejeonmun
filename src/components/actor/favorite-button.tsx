"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { toggleFavorite } from "@/app/(main)/actor/actions";
import { cn } from "@/lib/utils";

export const FavoriteButton = ({
  actorId,
  favorited: initial,
}: {
  actorId: number;
  favorited: boolean;
}) => {
  const router = useRouter();

  const [favorited, setFavorited] = useState(initial);
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    // 낙관적 update
    const next = !favorited;

    setFavorited(next);

    startTransition(async () => {
      const result = await toggleFavorite(actorId, favorited);

      if (!result.ok) {
        setFavorited(favorited);

        if (result.message === "로그인이 필요해요.") {
          router.push(`/login?next=${encodeURIComponent(`/actor/${actorId}`)}`);
        }
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={favorited}
      className={cn(
        "border-border inline-flex w-fit items-center gap-1 rounded-4xl border px-3 py-1 text-xs transition-colors disabled:opacity-60",
        favorited ? "bg-primary text-white" : "text-text hover:bg-point",
      )}
    >
      {favorited ? "♥ 애정배우" : "♡ 애정배우"}
    </button>
  );
};
