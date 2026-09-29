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

export const CURRENT_UPDATE_ID = "2026-09-29";
export const UPDATE_NOTICE_MESSAGE = `🎉 [업데이트 안내 (9/29)]
- 캐스팅 캘린더 배우 필터에서 같은 배역 배우는 한 명만 나와도, 다른 배역 배우는 함께 나오는 회차만 보이도록 개선 (예: 햄릿 두 명 + 오필리아 한 명을 고르면 각 햄릿과 그 오필리아의 페어 회차)
- 캐스팅 업로드 확인 화면에서 배역명을 이미 있는 배역명으로 고치면 한쪽 배우가 사라지던 문제 수정 (두 배우 모두 그 배역에 남아요)
- 내 공연 캘린더에 공유 버튼 추가 (로그인 없이 열람 가능)`;
