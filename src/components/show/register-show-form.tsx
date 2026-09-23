"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  createUserShowAction,
  updateUserShowAction,
} from "@/app/(main)/show/register/actions";
import { ImageZoom } from "@/components/image-zoom";
import { Input } from "@/components/ui/input";
import { useLoginRedirect } from "@/hook/useLoginRedirect";
import { createClient } from "@/lib/supabase/client";
import { GENRE } from "@/type/show";
import {
  MAX_TICKET_LINKS,
  MAX_USER_SHOW_POSTER_BYTES,
  TicketLink,
  USER_SHOW_POSTER_BUCKET,
  UserShowForEdit,
} from "@/type/user-show";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const RegisterShowForm = ({
  initialTitle = "",
  show,
}: {
  initialTitle?: string;
  // 있으면 새로 등록하지 않고 이 공연을 수정한다
  show?: UserShowForEdit;
}) => {
  const router = useRouter();
  const loginRedirect = useLoginRedirect(
    show ? `/show/${show.id}/edit` : "/show/register",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(show?.title ?? initialTitle);
  const [poster, setPoster] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(
    show?.posterUrl ?? null,
  );
  const [periodStart, setPeriodStart] = useState(show?.periodStart ?? "");
  const [periodEnd, setPeriodEnd] = useState(show?.periodEnd ?? "");
  const [genre, setGenre] = useState(show?.genre ?? GENRE.options[0]!.value);
  const [venue, setVenue] = useState(show?.venue ?? "");
  const [ticketLinks, setTicketLinks] = useState<TicketLink[]>(
    show?.ticketLinks.length ? show.ticketLinks : [{ name: "", url: "" }],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handlePosterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    if (file.size > MAX_USER_SHOW_POSTER_BYTES) {
      setError("이미지는 10MB를 넘을 수 없어요.");
      return;
    }

    if (posterPreview) URL.revokeObjectURL(posterPreview);

    setError(null);
    setPoster(file);
    setPosterPreview(URL.createObjectURL(file));
  };

  const updateTicketLink = (index: number, next: Partial<TicketLink>) =>
    setTicketLinks((current) =>
      current.map((link, at) => (at === index ? { ...link, ...next } : link)),
    );

  const addTicketLink = () =>
    setTicketLinks((current) => [...current, { name: "", url: "" }]);

  const removeTicketLink = (index: number) =>
    setTicketLinks((current) => current.filter((_, at) => at !== index));

  const handleSubmit = () => {
    setError(null);

    if (!title.trim()) return setError("제목을 입력해 주세요.");
    if (!poster && !show) return setError("포스터 이미지를 올려주세요.");
    if (!periodStart || !periodEnd)
      return setError("공연 기간을 입력해 주세요.");
    if (periodStart > periodEnd) return setError("시작일이 종료일보다 늦어요.");

    startTransition(async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getClaims();
      const userId = data?.claims?.sub;

      if (!userId) {
        loginRedirect("로그인이 필요해요.");
        return;
      }

      let posterPath = show?.posterPath ?? "";

      if (poster) {
        const extension = EXTENSIONS[poster.type] ?? "jpg";

        posterPath = `${userId}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(USER_SHOW_POSTER_BUCKET)
          .upload(posterPath, poster, { contentType: poster.type });

        if (uploadError) {
          setError("포스터를 올리지 못했어요. 잠시 후 다시 시도해 주세요.");
          return;
        }
      }

      const input = {
        title,
        posterPath,
        periodStart,
        periodEnd,
        genre,
        venue,
        ticketLinks,
      };

      const result = show
        ? await updateUserShowAction(show.id, input)
        : await createUserShowAction(input);

      if (!result.ok) {
        if (loginRedirect(result.message)) return;

        setError(result.message);
        return;
      }

      router.push(`/show/${result.id}`);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-text-muted text-xs font-bold">
          제목 <span className="text-destructive">*</span>
        </span>
        <Input
          value={title}
          onChange={({ target }) => setTitle(target.value)}
          placeholder="공연 제목"
          disabled={pending}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-text-muted text-xs font-bold">
          포스터 이미지 <span className="text-destructive">*</span>
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handlePosterChange}
          className="hidden"
        />

        {posterPreview ? (
          <div className="flex items-center gap-2">
            <ImageZoom
              src={posterPreview}
              alt="포스터 미리보기"
              className="h-24 w-18 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={pending}
              className="border-border text-text-muted inline-flex rounded-4xl border px-3 py-1 text-xs disabled:opacity-60"
            >
              다른 사진 고르기
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="border-border text-text-muted inline-flex w-fit rounded-4xl border px-3 py-1 text-xs disabled:opacity-60"
          >
            사진 고르기
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-text-muted text-xs font-bold">
          공연 기간 <span className="text-destructive">*</span>
        </span>
        <div className="flex items-center gap-1">
          <Input
            type="date"
            value={periodStart}
            aria-label="시작일"
            onChange={({ target }) => setPeriodStart(target.value)}
            disabled={pending}
          />
          <span className="text-text-muted text-xs">~</span>
          <Input
            type="date"
            value={periodEnd}
            aria-label="종료일"
            onChange={({ target }) => setPeriodEnd(target.value)}
            disabled={pending}
          />
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-text-muted text-xs font-bold">장르</span>
        <select
          value={genre}
          onChange={({ target }) => setGenre(target.value as typeof genre)}
          disabled={pending}
          className="border-input text-text rounded-control h-10 border bg-transparent px-2 text-base disabled:opacity-50 md:text-sm"
        >
          {GENRE.options.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-text-muted text-xs font-bold">공연장</span>
        <Input
          value={venue}
          onChange={({ target }) => setVenue(target.value)}
          placeholder="예: 대학로 OO극장"
          disabled={pending}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-text-muted text-xs font-bold">예매처</span>
        <ul className="flex flex-col gap-1.5">
          {ticketLinks.map((link, index) => (
            <li key={index} className="flex items-center gap-1">
              <Input
                value={link.name}
                onChange={({ target }) =>
                  updateTicketLink(index, { name: target.value })
                }
                placeholder="예: 인터파크"
                aria-label="예매처 이름"
                className="w-24 shrink-0"
                disabled={pending}
              />
              <Input
                value={link.url}
                onChange={({ target }) =>
                  updateTicketLink(index, { url: target.value })
                }
                placeholder="https://..."
                aria-label="예매처 링크"
                disabled={pending}
              />
              {ticketLinks.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTicketLink(index)}
                  disabled={pending}
                  className="text-text-muted hover:text-destructive inline-flex w-fit shrink-0 rounded-4xl px-2 py-1 text-[11px] transition-colors disabled:opacity-60"
                >
                  삭제
                </button>
              )}
            </li>
          ))}
        </ul>
        {ticketLinks.length < MAX_TICKET_LINKS && (
          <button
            type="button"
            onClick={addTicketLink}
            disabled={pending}
            className="text-text-muted hover:text-primary inline-flex w-fit rounded-4xl px-2 py-1 text-[11px] underline underline-offset-2 transition-colors disabled:opacity-60"
          >
            + 예매처 추가
          </button>
        )}
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending}
        className="bg-primary rounded-full py-3.5 text-[14.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending
          ? show
            ? "저장하는 중…"
            : "등록하는 중…"
          : show
            ? "수정 저장하기"
            : "공연 등록하기"}
      </button>
    </div>
  );
};
