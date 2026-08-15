import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackButton } from "@/components/back-button";
import { SlotCard } from "@/components/casting/slot-card";
import { CastingViews, MonthNav } from "@/components/casting/casting-views";
import { CastingUploadButton } from "@/components/show/casting-upload-button";
import {
  getCalendarCells,
  getMonthRange,
  getToday,
  parseMonth,
  toInputDate,
  toIsoDate,
  toMonth,
} from "@/lib/date";
import { FALLBACK_COLOR, getColorMap } from "@/lib/actor-color";
import {
  getShowCastings,
  getShowFilterData,
  getSlotPairKey,
} from "@/service/casting";
import { getShow } from "@/service/show";
import {
  CASTING_VIEW,
  DEFAULT_CASTING_VIEW,
  parseActorsParam,
} from "@/type/casting";
import { ShowDetail } from "@/type/show";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; month?: string; actors?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const show = await getShow(id);

  if (!show) return { title: "공연을 찾을 수 없습니다 | 회전문" };

  return {
    title: `${show.prfnm} 캐스팅 일정 | 회전문`,
    description: `${show.prfnm}의 회차별 캐스팅`,
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
  } = await searchParams;

  const show = await getShow(id);

  if (!show) notFound();

  const monthDate = parseMonth(rawMonth ?? "") ?? getDefaultMonth(show);
  const month = toMonth(monthDate);
  const view = CASTING_VIEW.isCode(rawView) ? rawView : DEFAULT_CASTING_VIEW;

  const { start, end } = getMonthRange(monthDate);
  const slots = await getShowCastings(id, start, end);

  const { pairKeys, actors } = await getShowFilterData(id);

  const pairColors = getColorMap(pairKeys);
  const initialActors = parseActorsParam(rawActors, actors);

  return (
    <div className="flex flex-col gap-4">
      <BackButton />

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-text">{show.prfnm}</h2>
        <Link
          href={`/show/${id}`}
          className="w-fit text-xs text-text-muted underline underline-offset-2"
        >
          공연 정보 보기
        </Link>
      </div>

      <p className="text-xs text-text-muted">
        캐스팅 정보는 사용자 제보 기반이라 제보 시점 이후 변경된 내용은 반영이
        안 됐을 수 있어요.
      </p>

      {slots.length === 0 ? (
        <>
          <MonthNav month={month} />

          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-text-muted">
              아직 이 달의 캐스팅 정보가 없어요.
            </p>
            <p className="text-xs text-text-muted">
              캐스팅보드를 제보하면 회차별로 자동 정리돼요.
            </p>
          </div>
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
            label: getSlotPairKey(slot),
            colorClass: pairColors.get(getSlotPairKey(slot)) ?? FALLBACK_COLOR,
            filterKeys: slot.casting.map(({ actor }) => actor),
          }))}
          panels={Object.fromEntries(
            slots.map((slot) => [slot.id, <SlotCard key={slot.id} slot={slot} />]),
          )}
          listItems={Object.fromEntries(
            slots.map((slot) => [
              slot.id,
              <SlotCard key={slot.id} slot={slot} showDate />,
            ]),
          )}
          filterOptions={actors}
          initialActors={initialActors}
        />
      )}

      <div className="border-t border-border pt-4">
        <CastingUploadButton showId={id} />
      </div>
    </div>
  );
}
