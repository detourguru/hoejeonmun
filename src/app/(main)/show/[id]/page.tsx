import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackButton } from "@/components/back-button";
import { ShowDetail } from "@/components/show/show-detail";
import { LoadingGhost } from "@/components/ui/loading-ghost";
import { toIsoDate } from "@/lib/date";
import { SITE_URL } from "@/lib/site";
import { getShow } from "@/service/show";

import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const show = await getShow(id);

  if (!show) return { title: "공연을 찾을 수 없습니다" };

  const description = `${show.fcltynm} · ${show.prfpdfrom} ~ ${show.prfpdto}`;

  return {
    title: show.prfnm,
    description,
    alternates: { canonical: `/show/${id}` },
    openGraph: {
      type: "website",
      title: show.prfnm,
      description,
      images: show.poster ? [show.poster] : undefined,
    },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const show = await getShow(id);

  if (!show) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TheaterEvent",
    name: show.prfnm,
    url: `${SITE_URL}/show/${id}`,
    image: show.poster || undefined,
    startDate: toIsoDate(show.prfpdfrom),
    endDate: toIsoDate(show.prfpdto),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: show.fcltynm,
    },
  };

  return (
    <div className="flex flex-col gap-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <BackButton />

      {/* TODO: 예외처리 추가 필요 */}
      <Suspense fallback={<LoadingGhost />}>
        <ShowDetail id={id} />
      </Suspense>
    </div>
  );
}
