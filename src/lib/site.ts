// 커스텀 도메인 연결 전까지는 Vercel 프로덕션 도메인을 그대로 사용한다.
// 도메인을 연결하면 VERCEL_PROJECT_PRODUCTION_URL 값이 그 도메인으로 바뀌므로 코드 변경 없이 반영된다.
const PRODUCTION_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_NAME = "회전문";
export const SITE_URL = PRODUCTION_URL
  ? `https://${PRODUCTION_URL}`
  : "http://localhost:3000";
export const SITE_DESCRIPTION =
  "한눈에 확인하는 뮤지컬/연극 캐스팅 및 이벤트 정보";

export const CURRENT_UPDATE_ID = "2026-08-30-event-info";
export const UPDATE_NOTICE_MESSAGE = `🎉 [업데이트 안내 (8/30 14:00)]
- 키보드 닫기 시 뒤로가기가 눌리던 현상
- 이벤트가 회차별로 생성되던 현상
- 불필요한 버튼 정리`;
