// 커스텀 도메인 연결 전까지는 Vercel 프로덕션 도메인을 그대로 사용한다.
// 도메인을 연결하면 VERCEL_PROJECT_PRODUCTION_URL 값이 그 도메인으로 바뀌므로 코드 변경 없이 반영된다.
const PRODUCTION_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_NAME = "회전문";
export const SITE_URL = PRODUCTION_URL
  ? `https://${PRODUCTION_URL}`
  : "http://localhost:3000";
export const SITE_DESCRIPTION =
  "놓치기 아까운 공연 이벤트부터 회차 관리까지 회전문에서 한번에";

export const CURRENT_UPDATE_ID = "2026-08-31-casting-fix-1";
export const UPDATE_NOTICE_MESSAGE = `🎉 [업데이트 안내 (8/31)]
- 적용회차 체크박스가 클릭되지 않던 버그가 수정되었어요
- 동명 배역도 다른 배역으로 인식하도록 수정되었어요
- 캐스팅 정정 시 다른 회차까지 함께 바뀌던 버그가 수정되었어요
- 한 배역을 여러 배우가 맡을 때(앙상블 등) 모두 인식하도록 개선되었어요`;
