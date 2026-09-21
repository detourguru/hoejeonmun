"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { generateUserShowThumbnail } from "@/service/poster-thumbnail-generator";
import {
  createUserShow,
  getUserShowForEdit,
  isUserShowId,
  updateUserShow,
} from "@/service/user-show";
import { GENRE } from "@/type/show";
import { MAX_TICKET_LINKS, TicketLink, UserShowInput } from "@/type/user-show";

export type CreateUserShowResult =
  { ok: true; id: string } | { ok: false; message: string };

type UserShowFormInput = {
  title: string;
  posterPath: string;
  periodStart: string;
  periodEnd: string;
  genre: string;
  venue: string;
  ticketLinks: TicketLink[];
};

const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const isValidUrl = (value: string) => {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

async function getUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return data?.claims?.sub;
}

function validateUserShowInput(
  input: UserShowFormInput,
  userId: string,
): { ok: true; value: UserShowInput } | { ok: false; message: string } {
  const title = input.title.trim();

  if (!title) return { ok: false, message: "제목을 입력해 주세요." };
  if (!input.posterPath)
    return { ok: false, message: "포스터 이미지를 올려주세요." };

  if (!input.posterPath.startsWith(`${userId}/`))
    return { ok: false, message: "포스터 이미지를 다시 올려주세요." };

  if (!isValidDate(input.periodStart) || !isValidDate(input.periodEnd)) {
    return { ok: false, message: "공연 기간을 확인해 주세요." };
  }

  if (input.periodStart > input.periodEnd) {
    return { ok: false, message: "시작일이 종료일보다 늦어요." };
  }

  if (!GENRE.isCode(input.genre)) {
    return { ok: false, message: "장르를 선택해 주세요." };
  }

  const ticketLinks = input.ticketLinks
    .map(({ name, url }) => ({ name: name.trim(), url: url.trim() }))
    .filter(({ name, url }) => name && url);

  if (ticketLinks.length > MAX_TICKET_LINKS) {
    return {
      ok: false,
      message: `예매처는 최대 ${MAX_TICKET_LINKS}개까지 추가할 수 있어요.`,
    };
  }

  const invalidLink = ticketLinks.find(({ url }) => !isValidUrl(url));

  if (invalidLink) {
    return {
      ok: false,
      message: `'${invalidLink.name}' 예매처 링크 주소를 확인해 주세요.`,
    };
  }

  return {
    ok: true,
    value: {
      title,
      posterPath: input.posterPath,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      genre: input.genre,
      venue: input.venue.trim(),
      ticketLinks,
    },
  };
}

export async function createUserShowAction(
  input: UserShowFormInput,
): Promise<CreateUserShowResult> {
  const userId = await getUserId();

  if (!userId) return { ok: false, message: "로그인이 필요해요." };

  const validated = validateUserShowInput(input, userId);

  if (!validated.ok) return validated;

  try {
    const { id } = await createUserShow(validated.value, userId);

    // 등록 응답을 늦추지 않게 응답을 보낸 뒤 만든다
    after(() => generateUserShowThumbnail(id, validated.value.posterPath));

    return { ok: true, id };
  } catch (error) {
    console.error(error);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }
}

export async function updateUserShowAction(
  id: string,
  input: UserShowFormInput,
): Promise<CreateUserShowResult> {
  const userId = await getUserId();

  if (!userId) return { ok: false, message: "로그인이 필요해요." };
  if (!isUserShowId(id))
    return { ok: false, message: "수정할 수 없는 공연이에요." };

  const validated = validateUserShowInput(input, userId);

  if (!validated.ok) return validated;

  try {
    const current = await getUserShowForEdit(id, userId);

    if (!current || !(await updateUserShow(id, validated.value, userId))) {
      return { ok: false, message: "직접 등록한 공연만 수정할 수 있어요." };
    }

    if (current.posterPath !== validated.value.posterPath) {
      after(() => generateUserShowThumbnail(id, validated.value.posterPath));
    }

    revalidatePath(`/show/${id}`);

    return { ok: true, id };
  } catch (error) {
    console.error(error);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }
}
