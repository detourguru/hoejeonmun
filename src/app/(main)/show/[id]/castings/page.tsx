import Link from "next/link";
import { notFound } from "next/navigation";

import { BackButton } from "@/components/back-button";
import { CastingViews } from "@/components/casting/casting-views";
import { SlotCard } from "@/components/casting/slot-card";
import { CastingUploadButton } from "@/components/show/casting-upload-button";
import { SLOT_COLOR } from "@/lib/actor-color";
import {
  getCalendarCells,
  getMonthRange,
  getToday,
  isIsoDate,
  parseMonth,
  toInputDate,
  toIsoDate,
  toMonth,
} from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import {
  getShowCastings,
  getShowEvents,
  getShowFilterData,
  getEventsWithReportStatus,
  getSlotPairKey,
  getSlotsWithStatus,
} from "@/service/casting";
import { getShow } from "@/service/show";
import {
  CASTING_VIEW,
  DEFAULT_CASTING_VIEW,
  parseActorsParam,
} from "@/type/casting";
import { ShowDetail } from "@/type/show";

import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    view?: string;
    month?: string;
    actors?: string;
    date?: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const show = await getShow(id);

  if (!show) return { title: "공연을 찾을 수 없습니다" };

  const title = `${show.prfnm} 캐스팅 일정`;
  const description = `${show.prfnm}의 회차별 캐스팅`;

  return {
    title,
    description,
    alternates: { canonical: `/show/${id}/castings` },
    openGraph: {
      title,
      description,
      images: show.poster ? [show.poster] : undefined,
    },
  };
}

// 공연이 아직 안 열렸거나 이미 끝났으면 이번 달을 보여줘야 빈 달력만 나온다
function getDefaultMonth(show: ShowDetail) {
  const today = toInputDate(getToday());
  const from = toIsoDate(show.prfpdfrom);
  const to = toIsoDate(show.prfpdto);

  const target = today < from ? from : today > to ? to : today;

  return parseMonth(target.slice(0, 7)) ?? getToday();
}

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const {
    view: rawView,
    month: rawMonth,
    actors: rawActors,
    date: rawDate,
  } = await searchParams;

  const show = await getShow(id);

  if (!show) notFound();

  const monthDate = parseMonth(rawMonth ?? "") ?? getDefaultMonth(show);
  const month = toMonth(monthDate);
  const view = CASTING_VIEW.isCode(rawView) ? rawView : DEFAULT_CASTING_VIEW;
  const initialDate = rawDate && isIsoDate(rawDate) ? rawDate : undefined;

  const { start, end } = getMonthRange(monthDate);
  const cells = getCalendarCells(monthDate);
  const supabase = await createClient();

  const [slots, events, auth, filterData] = await Promise.all([
    getShowCastings(id, start, end),
    getShowEvents(id, start, end),
    supabase.auth.getClaims(),
    getShowFilterData(id),
  ]);

  const initialActors = parseActorsParam(rawActors, filterData.actors);
  const eventsWithReportStatus = await getEventsWithReportStatus(events);
  const slotsWithStatus = await getSlotsWithStatus(slots);

  const eventsBySlotId = new Map<number, { id: number; title: string }[]>();

  for (const event of eventsWithReportStatus) {
    for (const slotId of event.slotIds) {
      eventsBySlotId.set(slotId, [
        ...(eventsBySlotId.get(slotId) ?? []),
        { id: event.id, title: event.title },
      ]);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <BackButton />

      <div className="flex flex-col gap-1">
        <h2 className="text-text text-lg font-bold">{show.prfnm}</h2>
        <Link
          href={`/show/${id}`}
          className="text-text-muted w-fit text-xs underline underline-offset-2"
        >
          공연 정보 보기
        </Link>
      </div>

      <p className="text-text-muted text-xs">
        캐스팅 정보는 사용자 제보 기반이라 제보 시점 이후 변경된 내용은 반영이
        안 됐을 수 있어요.
      </p>

      <CastingViews
        showId={id}
        month={month}
        initialView={view}
        initialDate={initialDate}
        cells={cells}
        events={eventsWithReportStatus}
        slots={slotsWithStatus.map((slot) => ({
          id: slot.id,
          date: slot.date,
          time: slot.time,
          label: getSlotPairKey(slot),
          colorClass: SLOT_COLOR,
          filterKeys: slot.casting.map(({ actor }) => actor),
        }))}
        panels={Object.fromEntries(
          slotsWithStatus.map((slot) => [
            slot.id,
            <SlotCard
              key={slot.id}
              slot={slot}
              showId={id}
              events={eventsBySlotId.get(slot.id)}
            />,
          ]),
        )}
        listItems={Object.fromEntries(
          slotsWithStatus.map((slot) => [
            slot.id,
            <SlotCard
              key={slot.id}
              slot={slot}
              showId={id}
              showDate
              events={eventsBySlotId.get(slot.id)}
            />,
          ]),
        )}
        filterOptions={filterData.actors}
        initialActors={initialActors}
        empty={
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-text-muted text-sm">
              아직 이 달의 캐스팅 정보가 없어요.
            </p>
            <p className="text-text-muted text-xs">
              회원님이 캐스팅보드를 올려서 채워보시겠어요?
            </p>
            <a
              href="#casting-upload"
              className="bg-primary rounded-full px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
            >
              캐스팅보드 올리러 가기
            </a>
          </div>
        }
      />

      <div id="casting-upload" className="border-border border-t pt-4">
        <CastingUploadButton
          showId={id}
          isLoggedIn={Boolean(auth.data?.claims)}
        />
      </div>
    </div>
  );
}
