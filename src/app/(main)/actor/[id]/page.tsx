import { notFound } from "next/navigation";

import { ActorSchedule } from "@/components/actor/actor-schedule";
import { FavoriteButton } from "@/components/actor/favorite-button";
import { BackButton } from "@/components/back-button";
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

import type { Metadata } from "next";

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

  if (!actor) return { title: "배우를 찾을 수 없습니다" };

  const title = `${actor.name} 공연 일정`;
  const description = `${actor.name}의 회차별 공연 일정`;

  return {
    title,
    description,
    alternates: { canonical: `/actor/${id}` },
    openGraph: { title, description },
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
        <h2 className="text-text text-lg font-bold">{actor.name}</h2>
        <FavoriteButton actorId={actorId} favorited={favorited} />
      </div>

      <p className="text-text-muted text-xs">
        캐스팅 정보는 사용자 제보 기반이라 제보 시점 이후 변경된 내용은 반영이
        안 됐을 수 있어요.
      </p>

      <ActorSchedule
        month={month}
        initialView={view}
        cells={getCalendarCells(monthDate)}
        slots={slots}
        shows={shows}
      />
    </div>
  );
}
