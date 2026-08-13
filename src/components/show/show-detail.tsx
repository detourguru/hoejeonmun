import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StateBadge } from "@/components/show/state-badge";
import { Badge } from "@/components/ui/badge";
import { toArray } from "@/lib/kopis";
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
      className="flex items-center justify-between rounded border border-border px-2.5 py-1.5 text-xs text-text transition-colors hover:bg-point"
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
  <section className="flex flex-col gap-2 border-t border-border pt-4">
    <h2 className="text-sm font-bold text-text">{title}</h2>
    {children}
  </section>
);

// "배우A, 배우B" -> ["배우A", "배우B"]
const splitNames = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

export const ShowDetail = async ({ id }: { id: string }) => {
  const show = await getShow(id);

  if (!show) notFound();

  const cast = splitNames(show.prfcast);
  const crew = splitNames(show.prfcrew);
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
          <div className="h-44 w-32 shrink-0 rounded bg-point/40" />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex gap-1">
            <Badge variant="outline">{show.genrenm}</Badge>
            <StateBadge state={show.prfstate} />
          </div>

          <h1 className="text-lg font-bold break-keep text-text">
            {show.prfnm}
          </h1>

          <p className="text-xs text-text-muted">{show.fcltynm}</p>
          <p className="text-xs text-text-muted">{`${show.prfpdfrom} ~ ${show.prfpdto}`}</p>

          {relates.length > 0 && (
            <div className="mt-auto flex flex-col gap-1">
              <ul className="flex flex-col gap-1">
                {relates.slice(0, VISIBLE_RELATE_COUNT).map((relate) => (
                  <RelateLink key={relate.relateurl} {...relate} />
                ))}
              </ul>

              {relates.length > VISIBLE_RELATE_COUNT && (
                <details>
                  <summary className="cursor-pointer list-none text-xs text-text-muted [&::-webkit-details-marker]:hidden">
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

      <dl className="flex flex-col gap-1.5 rounded bg-surface p-3 text-sm">
        {details.map(({ label, value }) => (
          <div key={label} className="flex gap-2">
            <dt className="w-16 shrink-0 text-text-muted">{label}</dt>
            <dd className="min-w-0 whitespace-pre-line text-text">{value}</dd>
          </div>
        ))}
      </dl>

      <Section title="캐스팅보드">
        <Link
          href={`/show/${id}/castings`}
          className="inline-flex w-fit rounded-4xl border border-border px-3 py-1 text-xs text-text transition-colors hover:bg-point"
        >
          회차별 캐스팅 보기
        </Link>
      </Section>

      {show.dtguidance && (
        <Section title="공연 시간">
          <p className="whitespace-pre-line text-sm text-text">
            {show.dtguidance}
          </p>
        </Section>
      )}

      {cast.length > 0 && (
        <Section title="출연진">
          {/* TODO: UGC 태깅 데이터가 쌓이면 /actor/{id} 로 연결 */}
          <ul className="flex flex-wrap gap-1">
            {cast.map((name) => (
              <li key={name}>
                <Badge variant="outline">{name}</Badge>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {crew.length > 0 && (
        <Section title="제작진">
          <p className="text-sm text-text-muted">{crew.join(", ")}</p>
        </Section>
      )}

      {show.sty && (
        <Section title="줄거리">
          <p className="whitespace-pre-line text-sm leading-relaxed text-text">
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
