import { redirect } from "next/navigation";

import { FavoriteActorSlotCard } from "@/components/mypage/favorite-actor-slot-card";
import { FavoriteScheduleCalendar } from "@/components/mypage/favorite-schedule-calendar";
import { MyScheduleCalendar } from "@/components/mypage/my-schedule-calendar";
import { MyShowsTabs } from "@/components/mypage/my-shows-tabs";
import { MySlotCard } from "@/components/mypage/my-slot-card";
import { SLOT_COLOR, getActorColorMap } from "@/lib/actor-color";
import {
  getCalendarCells,
  getMonthRange,
  getToday,
  parseMonth,
  toMonth,
} from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import {
  displayActorName,
  getFavoriteActors,
  getFavoriteActorSlots,
} from "@/service/actor";
import { getMyEvents, getMySlots } from "@/service/mypage";
import { getShowRuntimes } from "@/service/show";
import {
  CASTING_VIEW,
  CastingView,
  DEFAULT_CASTING_VIEW,
  DEFAULT_MY_SHOWS_TAB,
  MY_SHOWS_TAB,
} from "@/type/casting";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 공연 | 회전문",
};

type Props = {
  searchParams: Promise<{ view?: string; month?: string; tab?: string }>;
};

type SectionProps = {
  userId: string;
  monthDate: Date;
  view: CastingView;
};

async function MineSection({ userId, monthDate, view }: SectionProps) {
  const { start, end } = getMonthRange(monthDate);

  const [slots, events] = await Promise.all([
    getMySlots(userId, start, end),
    getMyEvents(userId, start, end),
  ]);

  const runtimeByShowId = await getShowRuntimes([
    ...new Set(slots.map((slot) => slot.showId)),
  ]).catch((error) => {
    console.error("공연 러닝타임 조회 실패", error);

    return {};
  });

  return (
    <MyScheduleCalendar
      month={toMonth(monthDate)}
      initialView={view}
      cells={getCalendarCells(monthDate)}
      myEvents={events}
      mySlots={slots.map((slot) => ({
        id: slot.id,
        date: slot.date,
        time: slot.time,
        showId: slot.showId,
        label: slot.showName,
        colorClass: SLOT_COLOR,
      }))}
      myPanels={Object.fromEntries(
        slots.map((slot) => [
          slot.id,
          <MySlotCard key={slot.id} slot={slot} />,
        ]),
      )}
      myListItems={Object.fromEntries(
        slots.map((slot) => [
          slot.id,
          <MySlotCard key={slot.id} slot={slot} showDate />,
        ]),
      )}
      runtimeByShowId={runtimeByShowId}
    />
  );
}

async function FavoriteSection({ monthDate, view }: SectionProps) {
  const { start, end } = getMonthRange(monthDate);

  const favoriteActors = await getFavoriteActors();
  const favoriteSlots = await getFavoriteActorSlots(favoriteActors, start, end);

  // 먼저 즐겨찾기한 배우부터 색을 나눠 줘서, 새로 추가해도 기존 배우 색은 그대로다
  const displayNameById = new Map(
    favoriteActors.map((actor) => [actor.id, displayActorName(actor)]),
  );

  const actorColors = getActorColorMap(
    [...favoriteActors].reverse().map(({ id }) => id),
  );

  return (
    <FavoriteScheduleCalendar
      month={toMonth(monthDate)}
      initialView={view}
      cells={getCalendarCells(monthDate)}
      favoriteSlots={favoriteSlots.map((slot) => {
        const castingActors = [
          ...new Map(
            slot.casting.map(({ actor, actorId }) => [actorId, actor]),
          ),
        ];

        return {
          id: slot.id,
          date: slot.date,
          time: slot.time,
          showId: slot.showId,
          label: slot.showName,
          filterKeys: castingActors.map(([, actor]) => actor),
          chips: castingActors.map(([actorId, actor]) => ({
            label: displayNameById.get(actorId) ?? actor,
            colorClass: actorColors.get(actorId) ?? SLOT_COLOR,
          })),
        };
      })}
      favoritePanels={Object.fromEntries(
        favoriteSlots.map((slot) => [
          slot.id,
          <FavoriteActorSlotCard
            key={slot.id}
            slot={slot}
            displayNameById={displayNameById}
          />,
        ]),
      )}
      favoriteListItems={Object.fromEntries(
        favoriteSlots.map((slot) => [
          slot.id,
          <FavoriteActorSlotCard
            key={slot.id}
            slot={slot}
            showDate
            displayNameById={displayNameById}
          />,
        ]),
      )}
      favoriteActorOptions={favoriteActors.map((actor) => ({
        value: actor.name,
        label: displayActorName(actor),
      }))}
    />
  );
}

export default async function Page({ searchParams }: Props) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) redirect("/login?next=/mypage/shows");

  const { view: rawView, month: rawMonth, tab: rawTab } = await searchParams;

  const monthDate = parseMonth(rawMonth ?? "") ?? getToday();
  const view = CASTING_VIEW.isCode(rawView) ? rawView : DEFAULT_CASTING_VIEW;
  const tab = MY_SHOWS_TAB.isCode(rawTab) ? rawTab : DEFAULT_MY_SHOWS_TAB;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-text text-xl font-bold">내 공연</h1>

      <MyShowsTabs current={tab} />

      {tab === "favorite" ? (
        <FavoriteSection userId={userId} monthDate={monthDate} view={view} />
      ) : (
        <MineSection userId={userId} monthDate={monthDate} view={view} />
      )}
    </div>
  );
}
