// 커스텀 도메인 연결 전까지는 Vercel 프로덕션 도메인을 그대로 사용한다.
// 도메인을 연결하면 VERCEL_PROJECT_PRODUCTION_URL 값이 그 도메인으로 바뀌므로 코드 변경 없이 반영된다.
const PRODUCTION_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_NAME = "회전문";
export const SITE_URL = PRODUCTION_URL
  ? `https://${PRODUCTION_URL}`
  : "http://localhost:3000";
export const SITE_DESCRIPTION =
  "놓치기 아까운 공연 이벤트부터 회차 관리까지 회전문에서 한번에";

export const CURRENT_UPDATE_ID = "2026-08-31-event-info";
export const UPDATE_NOTICE_MESSAGE = `🎉 [업데이트 안내 (8/31 00:00)]
- 공연 상세로 넘어가던 애정배우 작품 배지를 해당 공연 필터로 수정했어요
- 오늘의 공연 피드가 생겼어요`;
