import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { getFavoriteActors } from "@/service/actor";

const PREVIEW_COUNT = 4;

export const FavoriteActorsPreview = async () => {
  const actors = await getFavoriteActors();

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-text text-lg font-bold">애정배우</h2>

        {actors.length > 0 && (
          <Link
            href="/mypage/favorite"
            className="text-text-muted hover:text-text flex items-center text-xs"
          >
            전체보기
            <ChevronRight className="size-3.5" />
          </Link>
        )}
      </div>

      {actors.length === 0 ? (
        <p className="text-text-muted py-4 text-center text-sm">
          아직 담아둔 배우가 없어요.
        </p>
      ) : (
        <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-0.5">
          {actors.slice(0, PREVIEW_COUNT).map(({ id, name }) => (
            <Link
              key={id}
              href={`/actor/${id}`}
              className="flex w-14 shrink-0 flex-col items-center gap-1.5"
            >
              <span className="bg-point/40 border-point flex size-12 items-center justify-center rounded-full border-2">
                <span className="text-primary text-base font-bold">
                  {name.charAt(0)}
                </span>
              </span>
              <span className="text-text-muted w-full truncate text-center text-[10px]">
                {name}
              </span>
            </Link>
          ))}

          {actors.length > PREVIEW_COUNT && (
            <Link
              href="/mypage/favorite"
              className="flex w-14 shrink-0 flex-col items-center gap-1.5"
            >
              <span className="bg-sub border-border flex size-12 items-center justify-center rounded-full border border-dashed">
                <span className="text-text-muted text-[11px] font-bold">
                  +{actors.length - PREVIEW_COUNT}
                </span>
              </span>
              <span className="text-text-muted w-full truncate text-center text-[10px]">
                더보기
              </span>
            </Link>
          )}
        </div>
      )}
    </section>
  );
};
