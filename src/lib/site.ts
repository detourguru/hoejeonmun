import { addDays, toInputDate } from "@/lib/date";

// 커스텀 도메인 연결 전까지는 Vercel 프로덕션 도메인을 그대로 사용한다.
// 도메인을 연결하면 VERCEL_PROJECT_PRODUCTION_URL 값이 그 도메인으로 바뀌므로 코드 변경 없이 반영된다.
const PRODUCTION_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_NAME = "회전문";
export const SITE_URL = PRODUCTION_URL
  ? `https://${PRODUCTION_URL}`
  : "http://localhost:3000";
export const SITE_DESCRIPTION =
  "놓치기 아까운 공연 이벤트부터 회차 관리까지 회전문에서 한번에";

export const GA_MEASUREMENT_ID = "G-4LSMECET6C";

export const CURRENT_UPDATE_ID = "2026-10-23";
export const UPDATE_NOTICE_MESSAGE = `🎉 [업데이트 안내 (10/23)]
- 이벤트가 많은 이미지를 올리면 분석이 1분을 넘겨 실패하던 문제 완화 (분석 대기 시간을 2분까지 늘렸어요)`;

const UPDATE_NOTICE_DAYS = 3;

export function isUpdateNoticeActive(updateId: string, today: string): boolean {
  const expiresOn = toInputDate(
    addDays(new Date(`${updateId}T00:00:00Z`), UPDATE_NOTICE_DAYS),
  );

  return today < expiresOn;
}
