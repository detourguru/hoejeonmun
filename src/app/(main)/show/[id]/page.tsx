import type { Metadata } from "next";
import { Suspense } from "react";

import { BackButton } from "@/components/back-button";
import { ShowDetail } from "@/components/show/show-detail";
import { getShow } from "@/service/show";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const show = await getShow(id);

  if (!show) return { title: "공연을 찾을 수 없습니다 | 회전문" };

  return {
    title: `${show.prfnm} | 회전문`,
    description: `${show.fcltynm} · ${show.prfpdfrom} ~ ${show.prfpdto}`,
    openGraph: { images: show.poster ? [show.poster] : [] },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-4">
      <BackButton />

      {/* TODO: 로딩, 예외처리 추가 필요 */}
      <Suspense
        fallback={
          <p className="py-16 text-center text-sm text-text-muted">
            불러오는 중...
          </p>
        }
      >
        <ShowDetail id={id} />
      </Suspense>
    </div>
  );
}
