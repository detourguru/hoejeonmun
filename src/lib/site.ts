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

export const CURRENT_UPDATE_ID = "2026-09-17";
export const UPDATE_NOTICE_MESSAGE = `🎉 [업데이트 안내 (9/17)]
- 캐스팅/이벤트를 올린 공연은 공연 기간이 지나도 검색에서 계속 찾을 수 있도록 수정
- 검색 결과에서 공연을 눌러 들어갈 때 간헐적으로 이전 화면으로 튕기던 문제 수정
- 오늘의 공연에서 상세 보고 돌아왔을 때 스크롤 위치가 유지되지 않던 문제 수정`;
