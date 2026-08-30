import {
  ArrowRight,
  Building2,
  Clock,
  ExternalLink,
  Ticket,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { splitActorNames } from "@/lib/actor-name";
import { toArray } from "@/lib/kopis";
import { cn } from "@/lib/utils";
import { getActorIdsByNames } from "@/service/actor";
import { getShowFilterData } from "@/service/casting";
import { getShow } from "@/service/show";
import { ShowRelate } from "@/type/show";

import { Badge } from "../ui/badge";
import { LoadingGhost } from "../ui/loading-ghost";

const RelateLink = ({ relatenm, relateurl }: ShowRelate) => (
  <a
    href={relateurl}
    target="_blank"
    rel="noopener noreferrer"
    className="border-border text-text hover:border-primary/40 hover:bg-primary/5 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors"
  >
    {relatenm}
    <ExternalLink className="text-text-muted size-3" />
  </a>
);

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="border-border flex flex-col gap-2 border-t pt-4">
    <h2 className="text-text text-sm font-bold">{title}</h2>
    {children}
  </section>
);

const CastSection = async ({
  id,
  prfcast,
}: {
  id: string;
  prfcast?: string;
}) => {
  const { actors: registeredActors } = await getShowFilterData(id);
  const cast =
    registeredActors.length > 0 ? registeredActors : splitActorNames(prfcast);

  if (cast.length === 0) return null;

  const actorIds = await getActorIdsByNames(cast);

  return (
    <Section title="출연진">
      <ul className="flex flex-wrap gap-1">
        {cast.map((name) => {
          const actorId = actorIds.get(name);

          return (
            <li key={name}>
              <Link
                href={
                  actorId
                    ? `/actor/${actorId}`
                    : `/actor/name/${encodeURIComponent(name)}`
                }
              >
                <Badge
                  variant="outline"
                  className={
                    actorId ? "border-primary text-primary" : undefined
                  }
                >
                  {name}
                </Badge>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
};

export const ShowDetail = async ({ id }: { id: string }) => {
  const show = await getShow(id);

  if (!show) notFound();

  const crew = splitActorNames(show.prfcrew);
  const relates = toArray(show.relates?.relate);
  const styurls = toArray(show.styurls?.styurl);

  const details = [
    { label: "공연 시간", value: show.prfruntime, icon: Clock },
    { label: "관람 연령", value: show.prfage, icon: UserRound },
    { label: "가격", value: show.pcseguidance, icon: Ticket },
    { label: "제작사", value: show.entrpsnm, icon: Building2 },
  ].filter(({ value }) => value);

  return (
    <article className="flex flex-col">
      {/* 히어로 */}
      <div className="via-primary relative -mx-4 h-72 overflow-hidden bg-gradient-to-br from-[#1a1c3c] to-[#3a4184] sm:h-80">
        {show.poster && (
          <Image
            fill
            priority
            sizes="100vw"
            className="object-cover"
            src={show.poster}
            alt={show.prfnm}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#14152b] from-10% via-[#14152b]/35 via-60% to-transparent" />

        <div className="absolute inset-x-4 bottom-4 flex flex-col gap-2">
          <div className="flex gap-1.5">
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10.5px] font-bold text-white backdrop-blur-sm">
              {show.genrenm}
            </span>
            <span className="bg-point text-primary rounded-full px-2.5 py-1 text-[10.5px] font-bold">
              {show.prfstate}
            </span>
          </div>

          <h1 className="font-heading text-xl leading-snug font-bold break-keep text-white">
            {show.prfnm}
          </h1>

          <p className="text-[11.5px] text-white/75">
            {show.fcltynm} · {show.prfpdfrom} ~ {show.prfpdto}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 pt-5">
        <div className="flex flex-col gap-3">
          {relates.length > 0 && (
            <div className="scrollbar-hide flex gap-2 overflow-x-auto">
              {relates.map((relate) => (
                <RelateLink key={relate.relateurl} {...relate} />
              ))}
            </div>
          )}

          {/* 정보 + 캐스팅보드 진입 (티켓 스텁) */}
          <div className="border-border bg-surface relative rounded-3xl border p-5">
            {details.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                {details.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <Icon className="text-primary mt-0.5 size-[15px] shrink-0" />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <dt className="text-text-muted text-[10.5px]">{label}</dt>
                      <dd className="text-text min-w-0 truncate text-[12.5px] font-bold whitespace-pre-line">
                        {value}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            )}

            <div
              className={cn(
                "border-border relative border-t-2 border-dashed",
                details.length > 0 ? "-mx-5 my-4" : "hidden",
              )}
              aria-hidden
            >
              <span className="bg-sub absolute -top-[11px] -left-[11px] size-[22px] rounded-full" />
              <span className="bg-sub absolute -top-[11px] -right-[11px] size-[22px] rounded-full" />
            </div>

            <Link
              href={`/show/${id}/castings`}
              className="bg-primary flex items-center justify-center gap-1.5 rounded-full py-3.5 text-[14.5px] font-bold text-white transition-opacity hover:opacity-90"
            >
              회차별 캐스팅 보기
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        {show.dtguidance && (
          <Section title="공연 시간">
            <p className="text-text text-sm whitespace-pre-line">
              {show.dtguidance}
            </p>
          </Section>
        )}

        <Suspense
          fallback={
            <LoadingGhost className="py-6" label="출연진 불러오는 중..." />
          }
        >
          <CastSection id={id} prfcast={show.prfcast} />
        </Suspense>

        {crew.length > 0 && (
          <Section title="제작진">
            <p className="text-text-muted text-sm">{crew.join(", ")}</p>
          </Section>
        )}

        {show.sty && (
          <Section title="줄거리">
            <p className="text-text text-sm leading-relaxed whitespace-pre-line">
              {show.sty}
            </p>
          </Section>
        )}

        {styurls.length > 0 && (
          <Section title="상세 정보">
            <div className="flex flex-col gap-2">
              {styurls.map((url) => (
                <Image
                  key={url}
                  src={url}
                  alt={`${show.prfnm} 소개 이미지`}
                  width="800"
                  height="1200"
                  sizes="(min-width: 448px) 448px, 100vw"
                  className="h-auto w-full rounded"
                />
              ))}
            </div>
          </Section>
        )}
      </div>
    </article>
  );
};
