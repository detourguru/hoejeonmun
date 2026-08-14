import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackButton } from "@/components/back-button";
import { ActorSlotCard } from "@/components/actor/actor-slot-card";
import { FavoriteButton } from "@/components/actor/favorite-button";
import { CastingViews, MonthNav } from "@/components/casting/casting-views";
import {
  getCalendarCells,
  getMonthRange,
  getToday,
  parseMonth,
  toMonth,
} from "@/lib/date";
import {
  getActor,
  getActorSchedule,
  getActorShows,
  isFavorited,
} from "@/service/actor";

import { CASTING_VIEW, DEFAULT_CASTING_VIEW } from "@/type/casting";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; month?: string }>;
};

const parseId = (value: string) => {
  const id = Number(value);

  return Number.isInteger(id) && id > 0 ? id : null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const actorId = parseId(id);
  const actor = actorId && (await getActor(actorId));

  if (!actor) return { title: "배우를 찾을 수 없습니다 | 회전문" };

  return {
    title: `${actor.name} 공연 일정 | 회전문`,
    description: `${actor.name}의 회차별 공연 일정`,
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const { view: rawView, month: rawMonth } = await searchParams;

  const actorId = parseId(id);

  if (!actorId) notFound();

  const actor = await getActor(actorId);

  if (!actor) notFound();

  const monthDate = parseMonth(rawMonth ?? "") ?? getToday();
  const month = toMonth(monthDate);
  const view = CASTING_VIEW.isCode(rawView) ? rawView : DEFAULT_CASTING_VIEW;

  const { start, end } = getMonthRange(monthDate);

  const [slots, shows, favorited] = await Promise.all([
    getActorSchedule(actorId, start, end),
    getActorShows(actorId),
    isFavorited(actorId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <BackButton />

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-text">{actor.name}</h2>
        <FavoriteButton actorId={actorId} favorited={favorited} />
      </div>

      {shows.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {shows.map(({ showId, showName }) => (
            <li key={showId}>
              <Link
                href={`/show/${showId}/castings`}
                className="inline-flex rounded-4xl border border-border px-2.5 py-1 text-xs text-text transition-colors hover:bg-point"
              >
                {showName}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {slots.length === 0 ? (
        <>
          <MonthNav month={month} />

          <p className="py-16 text-center text-sm text-text-muted">
            이 달에는 등록된 일정이 없어요.
          </p>
        </>
      ) : (
        <CastingViews
          month={month}
          initialView={view}
          cells={getCalendarCells(monthDate)}
          slots={slots.map((slot) => ({
            id: slot.id,
            date: slot.date,
            time: slot.time,
            label: slot.showName,
            colorClass: "bg-point text-text",
          }))}
          panels={Object.fromEntries(
            slots.map((slot) => [
              slot.id,
              <ActorSlotCard key={slot.id} slot={slot} />,
            ]),
          )}
          listItems={Object.fromEntries(
            slots.map((slot) => [
              slot.id,
              <ActorSlotCard key={slot.id} slot={slot} showDate />,
            ]),
          )}
        />
      )}
    </div>
  );
}
