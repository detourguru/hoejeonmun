import Link from "next/link";

import { FavoriteAliasForm } from "@/components/mypage/favorite-alias-form";
import { firstGrapheme } from "@/lib/grapheme";
import {
  displayActorName,
  getActorShows,
  getFavoriteActors,
} from "@/service/actor";

export const FavoriteActorsSection = async () => {
  const actors = await getFavoriteActors();

  const shows = await Promise.all(actors.map(({ id }) => getActorShows(id)));
  const showsByActorId = new Map(
    actors.map(({ id }, index) => [id, shows[index]]),
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-text text-lg font-bold">애정배우</h2>

      {actors.length === 0 ? (
        <p className="text-text-muted py-8 text-center text-sm">
          아직 담아둔 배우가 없어요.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {actors.map((actor) => {
            const { id, name, alias } = actor;
            const display = displayActorName(actor);

            return (
              <li
                key={id}
                className="border-border bg-surface relative flex flex-col gap-2 rounded-xl border p-3 shadow-sm"
              >
                <Link
                  href={`/actor/${id}`}
                  className="absolute inset-0 rounded-xl"
                  aria-label={name}
                />

                <div className="flex items-center gap-3">
                  <span className="bg-point/40 border-point flex size-10 shrink-0 items-center justify-center rounded-full border-2">
                    <span className="text-primary text-base font-bold">
                      {firstGrapheme(display)}
                    </span>
                  </span>

                  <span className="flex min-w-0 flex-col">
                    <span className="text-text truncate text-sm font-bold">
                      {display}
                    </span>
                    {alias && (
                      <span className="text-text-muted truncate text-[11px]">
                        {name}
                      </span>
                    )}
                    <span className="text-text-muted truncate text-[11px]">
                      {(showsByActorId.get(id) ?? [])
                        .map(({ showName }) => showName)
                        .join(", ")}
                    </span>
                  </span>
                </div>

                <FavoriteAliasForm actorId={id} alias={alias} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
