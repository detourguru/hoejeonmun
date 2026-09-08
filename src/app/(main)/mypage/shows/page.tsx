import { redirect } from "next/navigation";

import { FavoriteActorSlotCard } from "@/components/mypage/favorite-actor-slot-card";
import { MyScheduleTabs } from "@/components/mypage/my-schedule-tabs";
import { MySlotCard } from "@/components/mypage/my-slot-card";
import { SLOT_COLOR } from "@/lib/actor-color";
import {
  getCalendarCells,
  getMonthRange,
  getToday,
  parseMonth,
  toMonth,
} from "@/lib/date";
import { getShowColorMap } from "@/lib/show-color";
import { createClient } from "@/lib/supabase/server";
import { getFavoriteActors, getFavoriteActorSlots } from "@/service/actor";
import { getMyEvents, getMySlots } from "@/service/mypage";
import { CASTING_VIEW, DEFAULT_CASTING_VIEW } from "@/type/casting";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 공연 | 회전문",
};

type Props = {
  searchParams: Promise<{ view?: string; month?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) redirect("/login?next=/mypage/shows");

  const { view: rawView, month: rawMonth } = await searchParams;

  const monthDate = parseMonth(rawMonth ?? "") ?? getToday();
  const month = toMonth(monthDate);
  const view = CASTING_VIEW.isCode(rawView) ? rawView : DEFAULT_CASTING_VIEW;

  const { start, end } = getMonthRange(monthDate);

  const [slots, events, favoriteActors, favoriteSlots] = await Promise.all([
    getMySlots(userId, start, end),
    getMyEvents(userId, start, end),
    getFavoriteActors(),
    getFavoriteActorSlots(start, end),
  ]);

  const showColorMap = getShowColorMap(
    favoriteSlots.map(({ showId }) => showId),
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-text text-xl font-bold">내 공연</h1>

      <MyScheduleTabs
        month={month}
        initialView={view}
        cells={getCalendarCells(monthDate)}
        myEvents={events}
        mySlots={slots.map((slot) => ({
          id: slot.id,
          date: slot.date,
          time: slot.time,
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
        favoriteSlots={favoriteSlots.map((slot) => ({
          id: slot.id,
          date: slot.date,
          time: slot.time,
          label: slot.showName,
          colorClass: showColorMap.get(slot.showId) ?? SLOT_COLOR,
          filterKeys: slot.casting.map(({ actor }) => actor),
        }))}
        favoritePanels={Object.fromEntries(
          favoriteSlots.map((slot) => [
            slot.id,
            <FavoriteActorSlotCard key={slot.id} slot={slot} />,
          ]),
        )}
        favoriteListItems={Object.fromEntries(
          favoriteSlots.map((slot) => [
            slot.id,
            <FavoriteActorSlotCard key={slot.id} slot={slot} showDate />,
          ]),
        )}
        favoriteActorNames={favoriteActors.map(({ name }) => name)}
        hasFavorites={favoriteActors.length > 0}
      />
    </div>
  );
}
