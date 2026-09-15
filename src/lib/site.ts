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

export const CURRENT_UPDATE_ID = "2026-09-15";
export const UPDATE_NOTICE_MESSAGE = `🎉 [업데이트 안내 (9/15)]
- 캐스팅보드에서 배역란 추가/삭제 가능
- 공연 상세 페이지에서 오늘 회차 시간 안내 및 캘린더 바로가기
- 배역 표시 순서 고정
- 겹치는 회차 표시를 테두리 방식으로 변경
- 내 공연 겹침 판정에 무관한 공연이 포함되던 문제 수정
- 오늘 탭에서 정보 조회 실패한 공연이 대학로/대극장 필터에서 숨겨지던 문제 수정
- 검색창 사용 중 뒤로가기 시 페이지가 이동되던 문제 수정`;
