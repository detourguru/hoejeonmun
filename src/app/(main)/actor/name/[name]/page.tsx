import { redirect } from "next/navigation";

import { BackButton } from "@/components/back-button";
import { getActorIdsByNames } from "@/service/actor";

import type { Metadata } from "next";

type Props = { params: Promise<{ name: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;

  return {
    title: decodeURIComponent(name),
    robots: { index: false, follow: true },
  };
}

export default async function Page({ params }: Props) {
  const name = decodeURIComponent((await params).name);

  const actorId = (await getActorIdsByNames([name])).get(name);

  if (actorId) redirect(`/actor/${actorId}`);

  return (
    <div className="flex flex-col gap-4">
      <BackButton />

      <h2 className="text-text text-lg font-bold">{name}</h2>

      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-text-muted text-sm">
          아직 {name} 배우의 회차 정보가 없어요.
        </p>
        <p className="text-text-muted text-xs">
          공연 상세에서 캐스팅보드를 제보하면 회차별로 자동 정리돼요.
        </p>
      </div>
    </div>
  );
}
