import { createAdminClient } from "@/lib/supabase/admin";
import {
  ParsedCancelledEvent,
  ParsedCancelledSlot,
  ParsedCastingChange,
  ParsedPerformance,
  PendingEvent,
  SkippedPerformance,
} from "@/type/casting";

export type ParseResultData = {
  performances: ParsedPerformance[];
  events: PendingEvent[];
  skipped: SkippedPerformance[];
  cancelledSlots: ParsedCancelledSlot[];
  castingChanges: ParsedCastingChange[];
  cancelledEvents: ParsedCancelledEvent[];
};

export type ParseResultRow = {
  user_id: string;
  show_id: string;
  storage_paths: string[];
  result: ParseResultData;
  upload_id: number | null;
  created_at: string;
};

export const PARSE_RESULT_TTL_HOURS = 24;

const TTL_MS = PARSE_RESULT_TTL_HOURS * 60 * 60 * 1000;

type AccessRow = Pick<
  ParseResultRow,
  "user_id" | "show_id" | "upload_id" | "created_at"
>;

export type ParseResultAccess<T extends AccessRow> =
  { ok: true; row: T } | { ok: false; status: number; message: string };

export function checkParseResultAccess<T extends AccessRow>(
  row: T | null,
  { userId, showId, now }: { userId: string; showId: string; now: number },
): ParseResultAccess<T> {
  if (!row || row.user_id !== userId) {
    return {
      ok: false,
      status: 404,
      message: "분석 결과를 찾을 수 없어요. 이미지를 다시 올려 주세요.",
    };
  }

  if (row.show_id !== showId) {
    return { ok: false, status: 400, message: "잘못된 요청이에요." };
  }

  if (row.upload_id !== null) {
    return { ok: false, status: 409, message: "이미 저장한 분석 결과예요." };
  }

  if (now - Date.parse(row.created_at) > TTL_MS) {
    return {
      ok: false,
      status: 410,
      message:
        "분석한 지 오래돼서 저장할 수 없어요. 이미지를 다시 올려 주세요.",
    };
  }

  return { ok: true, row };
}

export async function insertParseResult(
  admin: ReturnType<typeof createAdminClient>,
  {
    userId,
    showId,
    storagePaths,
    result,
  }: {
    userId: string;
    showId: string;
    storagePaths: string[];
    result: ParseResultData;
  },
): Promise<string> {
  const { data, error } = await admin
    .from("casting_parse_results")
    .insert({
      user_id: userId,
      show_id: showId,
      storage_paths: storagePaths,
      result,
    })
    .select("id")
    .single();

  if (error) throw error;

  return data.id as string;
}

export async function getParseResult(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
): Promise<ParseResultRow | null> {
  const { data, error } = await admin
    .from("casting_parse_results")
    .select("user_id, show_id, storage_paths, result, upload_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return data as ParseResultRow | null;
}

export async function linkParseResultToUpload(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
  uploadId: number,
) {
  const { error } = await admin
    .from("casting_parse_results")
    .update({ upload_id: uploadId })
    .eq("id", id);

  if (error) console.error("파싱 결과와 업로드 연결 실패", error);
}

export async function purgeExpiredParseResults(
  admin: ReturnType<typeof createAdminClient>,
) {
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();

  const { error, count } = await admin
    .from("casting_parse_results")
    .delete({ count: "exact" })
    .is("upload_id", null)
    .lt("created_at", cutoff);

  if (error) throw error;

  return count ?? 0;
}
