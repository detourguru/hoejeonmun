import { notFound } from "next/navigation";

import { MyScheduleCalendar } from "@/components/mypage/my-schedule-calendar";
import { MySlotCard } from "@/components/mypage/my-slot-card";
import { SLOT_COLOR } from "@/lib/color";
import {
  getCalendarCells,
  getMonthRange,
  getToday,
  parseMonth,
  toMonth,
} from "@/lib/date";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEvents, getMySlots } from "@/service/mypage";
import { getCalendarShareOwner } from "@/service/share";
import { getShowRuntimes } from "@/service/show";
import { CASTING_VIEW, DEFAULT_CASTING_VIEW } from "@/type/casting";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "공유된 캘린더 | 회전문",
};

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ view?: string; month?: string }>;
};

export default async function Page({ params, searchParams }: Props) {
  const { token } = await params;
  const userId = await getCalendarShareOwner(token);

  if (!userId) notFound();

  const { view: rawView, month: rawMonth } = await searchParams;

  const monthDate = parseMonth(rawMonth ?? "") ?? getToday();
  const view = CASTING_VIEW.isCode(rawView) ? rawView : DEFAULT_CASTING_VIEW;
  const { start, end } = getMonthRange(monthDate);

  const admin = createAdminClient();

  const [slots, events] = await Promise.all([
    getMySlots(userId, start, end, admin),
    getMyEvents(userId, start, end, admin),
  ]);

  const runtimeByShowId = await getShowRuntimes([
    ...new Set(slots.map((slot) => slot.showId)),
  ]).catch((error) => {
    console.error("공연 러닝타임 조회 실패", error);

    return {};
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-text text-xl font-bold">공유된 공연 캘린더</h1>

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
            <MySlotCard key={slot.id} slot={slot} readOnly />,
          ]),
        )}
        myListItems={Object.fromEntries(
          slots.map((slot) => [
            slot.id,
            <MySlotCard key={slot.id} slot={slot} showDate readOnly />,
          ]),
        )}
        runtimeByShowId={runtimeByShowId}
      />
    </div>
  );
}
