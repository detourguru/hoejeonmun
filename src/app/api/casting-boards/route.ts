import * as z from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  hasKnownCastOverlap,
  parseCastingBoard,
  saveCastingBoard,
} from "@/service/casting-board";
import { getShow } from "@/service/show";
import { CASTING_BOARD_BUCKET } from "@/type/casting";

export const maxDuration = 60;

const bodySchema = z.object({
  showId: z.string().min(1),
  storagePath: z.string().min(1),
});

const fail = (status: number, message: string) =>
  Response.json({ message }, { status });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return fail(401, "로그인이 필요해요.");

  const body = bodySchema.safeParse(await request.json().catch(() => null));

  if (!body.success) return fail(400, "잘못된 요청이에요.");

  const { showId, storagePath } = body.data;

  // 남이 올린 파일을 자기 제보로 등록하는 걸 막는다.
  // 다만 원본이 공개라 내려받아 자기 폴더에 다시 올리면 이 검사는 통과한다.
  // 최신 우선 채택과 붙으면 옛 캐스팅보드를 재업로드해 수정본을 되돌리는 리플레이가
  // 가능하고, 지금 방어는 신고 5건뿐이다. 막으려면 uploads에 이미지 해시를 두고
  // 같은 공연에 동일 이미지 재업로드를 거르는 쪽이 가장 싸다.
  if (!storagePath.startsWith(`${userId}/`)) {
    return fail(403, "잘못된 요청이에요.");
  }

  const show = await getShow(showId);

  if (!show) return fail(404, "공연을 찾을 수 없어요.");

  const admin = createAdminClient();

  const { data: image, error: downloadError } = await admin.storage
    .from(CASTING_BOARD_BUCKET)
    .download(storagePath);

  if (downloadError || !image) {
    return fail(404, "업로드된 이미지를 찾을 수 없어요.");
  }

  try {
    const { performances, skippedCount } = await parseCastingBoard(image, show);

    if (performances.length === 0) {
      return fail(422, "이미지에서 캐스팅 표를 찾지 못했어요.");
    }

    if (!hasKnownCastOverlap(performances, show)) {
      return fail(422, "이 공연의 캐스팅보드가 맞는지 확인해 주세요.");
    }

    const result = await saveCastingBoard({
      showId,
      userId,
      storagePath,
      performances,
      skippedCount,
    });

    return Response.json(result);
  } catch (error) {
    console.error(error);

    return fail(500, "캐스팅보드를 분석하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
}
