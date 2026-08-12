import Image from "next/image";
import { notFound } from "next/navigation";

import { StateBadge } from "@/components/show/state-badge";
import { Badge } from "@/components/ui/badge";
import { toArray } from "@/lib/kopis";
import { getShow } from "@/service/show";

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
    { label: "공연장", value: show.fcltynm },
    { label: "공연 기간", value: `${show.prfpdfrom} ~ ${show.prfpdto}` },
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

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex gap-1">
            <Badge variant="outline">{show.genrenm}</Badge>
            <StateBadge state={show.prfstate} />
          </div>

          <h1 className="text-lg font-bold break-keep text-text">
            {show.prfnm}
          </h1>

          <p className="text-xs text-text-muted">{show.area}</p>
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

      {/*
        TODO: 캐스팅보드(달력/목록 토글) + 업로드 진입점
        회차 데이터는 Kopis에 없어 UGC 업로드 -> Gemini 파싱 -> Supabase 저장이 선행되어야함
      */}
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

      {relates.length > 0 && (
        <Section title="예매처">
          <ul className="flex flex-wrap gap-2">
            {relates.map(({ relatenm, relateurl }) => (
              <li key={relateurl}>
                <a
                  href={relateurl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-4xl border border-border px-3 py-1 text-xs text-text transition-colors hover:bg-point"
                >
                  {relatenm}
                </a>
              </li>
            ))}
          </ul>
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
