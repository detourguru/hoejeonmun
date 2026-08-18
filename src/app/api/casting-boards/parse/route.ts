import * as z from "zod";

import { errorMessage, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  attachOverlappingEvents,
  attachSuggestedDuplicates,
  hasKnownCastOverlap,
  isEventForShow,
  logParseFailure,
  parseCastingBoard,
  toPendingEvents,
} from "@/service/casting-board";
import { getShow } from "@/service/show";
import { CASTING_BOARD_BUCKET } from "@/type/casting";

export const maxDuration = 60;

const bodySchema = z.object({
  showId: z.string().min(1),
  storagePaths: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return fail(401, "로그인이 필요해요.");

  const body = bodySchema.safeParse(await request.json().catch(() => null));

  if (!body.success) return fail(400, "잘못된 요청이에요.");

  const { showId, storagePaths } = body.data;

  if (!storagePaths.every((path) => path.startsWith(`${userId}/`))) {
    return fail(403, "잘못된 요청이에요.");
  }

  const show = await getShow(showId);

  if (!show) return fail(404, "공연을 찾을 수 없어요.");

  const admin = createAdminClient();

  const downloads = await Promise.all(
    storagePaths.map((path) =>
      admin.storage.from(CASTING_BOARD_BUCKET).download(path),
    ),
  );

  if (downloads.some(({ data: image, error }) => error || !image)) {
    return fail(404, "업로드된 이미지를 찾을 수 없어요.");
  }

  const images = downloads.map(({ data: image }) => image!);

  try {
    const { performances, dateTags, events, skippedCount, reason } =
      await parseCastingBoard(images, show);

    if (performances.length === 0 && events.length === 0) {
      await logParseFailure({
        admin,
        showId,
        userId,
        storagePaths,
        type: "no_table_found",
        reason,
      });

      return fail(
        422,
        reason
          ? `이미지에서 캐스팅 표나 이벤트 안내를 찾지 못했어요. (${reason})`
          : "이미지에서 캐스팅 표나 이벤트 안내를 찾지 못했어요.",
      );
    }

    if (performances.length > 0 && !hasKnownCastOverlap(performances, show)) {
      await logParseFailure({
        admin,
        showId,
        userId,
        storagePaths,
        type: "cast_mismatch",
      });

      return fail(422, "이 공연의 캐스팅보드가 맞는지 확인해 주세요.");
    }

    if (!(await isEventForShow(events, show))) {
      await logParseFailure({
        admin,
        showId,
        userId,
        storagePaths,
        type: "show_mismatch",
        reason: `포스터에서 읽은 공연명: ${[
          ...new Set(events.map(({ rawTitle }) => rawTitle)),
        ].join(" / ")}`,
      });

      return fail(422, "이 공연의 이벤트가 맞는지 확인해 주세요.");
    }

    const pendingEvents = await attachSuggestedDuplicates(
      await attachOverlappingEvents(showId, toPendingEvents(dateTags, events)),
    );

    return Response.json({
      performances,
      events: pendingEvents,
      skippedCount,
    });
  } catch (error) {
    console.error(error);

    await logParseFailure({
      admin,
      showId,
      userId,
      storagePaths,
      type: "exception",
      reason: errorMessage(error),
    });

    return fail(
      500,
      "캐스팅보드를 분석하지 못했어요. 잠시 후 다시 시도해 주세요.",
    );
  }
}
