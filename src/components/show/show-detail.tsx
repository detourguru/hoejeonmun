import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StateBadge } from "@/components/show/state-badge";
import { Badge } from "@/components/ui/badge";
import { splitActorNames } from "@/lib/actor-name";
import { toArray } from "@/lib/kopis";
import { getActorIdsByNames } from "@/service/actor";
import { getShowFilterData } from "@/service/casting";
import { getShow } from "@/service/show";
import { ShowRelate } from "@/type/show";

// 헤더 높이가 포스터를 넘지 않도록 접지 않고 보여줄 예매처 수
const VISIBLE_RELATE_COUNT = 2;

const RelateLink = ({ relatenm, relateurl }: ShowRelate) => (
  <li>
    <a
      href={relateurl}
      target="_blank"
      rel="noopener noreferrer"
      className="border-border text-text hover:bg-point flex items-center justify-between rounded border px-2.5 py-1.5 text-xs transition-colors"
    >
      {relatenm}
      <span aria-hidden>↗</span>
    </a>
  </li>
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

export const ShowDetail = async ({ id }: { id: string }) => {
  const show = await getShow(id);

  if (!show) notFound();

  // 제보된 캐스팅보드가 있으면 캐스트들 / fallback: kopis 제공
  const { actors: registeredActors } = await getShowFilterData(id);
  const usingKopisCast = registeredActors.length === 0;
  const cast = usingKopisCast
    ? splitActorNames(show.prfcast)
    : registeredActors;

  const crew = splitActorNames(show.prfcrew);
  const actorIds = await getActorIdsByNames(cast);
  const relates = toArray(show.relates?.relate);
  const styurls = toArray(show.styurls?.styurl);

  const details = [
    { label: "공연 시간", value: show.prfruntime },
    { label: "관람 연령", value: show.prfage },
    { label: "가격", value: show.pcseguidance },
    { label: "제작사", value: show.entrpsnm },
  ].filter(({ value }) => value);

  return (
    <article className="flex flex-col gap-4">
      <header className="flex gap-3">
        {show.poster ? (
          <Image
            width="140"
            height="200"
            className="h-44 w-32 shrink-0 rounded object-cover"
            src={show.poster}
            alt={show.prfnm}
            priority
          />
        ) : (
          <div className="bg-point/40 h-44 w-32 shrink-0 rounded" />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex gap-1">
            <Badge variant="outline">{show.genrenm}</Badge>
            <StateBadge state={show.prfstate} />
          </div>

          <h1 className="text-text text-lg font-bold break-keep">
            {show.prfnm}
          </h1>

          <p className="text-text-muted text-xs">{show.fcltynm}</p>
          <p className="text-text-muted text-xs">{`${show.prfpdfrom} ~ ${show.prfpdto}`}</p>

          {relates.length > 0 && (
            <div className="mt-auto flex flex-col gap-1">
              <ul className="flex flex-col gap-1">
                {relates.slice(0, VISIBLE_RELATE_COUNT).map((relate) => (
                  <RelateLink key={relate.relateurl} {...relate} />
                ))}
              </ul>

              {relates.length > VISIBLE_RELATE_COUNT && (
                <details>
                  <summary className="text-text-muted cursor-pointer list-none text-xs [&::-webkit-details-marker]:hidden">
                    예매처 {relates.length - VISIBLE_RELATE_COUNT}곳 더 보기
                  </summary>
                  <ul className="mt-1 flex flex-col gap-1">
                    {relates.slice(VISIBLE_RELATE_COUNT).map((relate) => (
                      <RelateLink key={relate.relateurl} {...relate} />
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </header>

      <dl className="bg-surface flex flex-col gap-1.5 rounded p-3 text-sm">
        {details.map(({ label, value }) => (
          <div key={label} className="flex gap-2">
            <dt className="text-text-muted w-16 shrink-0">{label}</dt>
            <dd className="text-text min-w-0 whitespace-pre-line">{value}</dd>
          </div>
        ))}
      </dl>

      <Section title="캐스팅보드">
        <Link
          href={`/show/${id}/castings`}
          className="border-border text-text hover:bg-point inline-flex w-fit rounded-4xl border px-3 py-1 text-xs transition-colors"
        >
          회차별 캐스팅 보기
        </Link>
      </Section>

      {show.dtguidance && (
        <Section title="공연 시간">
          <p className="text-text text-sm whitespace-pre-line">
            {show.dtguidance}
          </p>
        </Section>
      )}

      {cast.length > 0 && (
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
      )}

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
                className="h-auto w-full rounded"
              />
            ))}
          </div>
        </Section>
      )}
    </article>
  );
};
