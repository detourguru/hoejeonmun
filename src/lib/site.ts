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

export const CURRENT_UPDATE_ID = "2026-09-23";
export const UPDATE_NOTICE_MESSAGE = `🎉 [업데이트 안내 (9/23)]
- 검색에서 종료된 공연도 "공연종료" 상태로 찾을 수 있도록 수정
- 달력의 이벤트·배우 색과 공연 상태 뱃지를 무지개색 대신 서비스 색(남색/노랑)에 맞춘 차분한 색으로 정리
- 이벤트를 등록할 때 같은 이벤트가 달력에 여러 번 뜨던 문제 수정
- 직접 등록한 공연이 나중에 공식 정보로도 올라와 검색에 두 번 나오던 공연들을 하나로 합침
- 하단 메뉴로 내 공연에 갔다 돌아와도 보던 화면(공연 달력 등)이 그대로 뜨도록 개선. 같은 메뉴를 다시 누르면 첫 화면으로 이동
- 공연 상태 표시를 "공연완료"에서 "공연종료"로 변경`;
