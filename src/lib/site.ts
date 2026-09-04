// 커스텀 도메인 연결 전까지는 Vercel 프로덕션 도메인을 그대로 사용한다.
// 도메인을 연결하면 VERCEL_PROJECT_PRODUCTION_URL 값이 그 도메인으로 바뀌므로 코드 변경 없이 반영된다.
const PRODUCTION_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_NAME = "회전문";
export const SITE_URL = PRODUCTION_URL
  ? `https://${PRODUCTION_URL}`
  : "http://localhost:3000";
export const SITE_DESCRIPTION =
  "놓치기 아까운 공연 이벤트부터 회차 관리까지 회전문에서 한번에";

export const CURRENT_UPDATE_ID = "2026-09-04-bugfix-1";
export const UPDATE_NOTICE_MESSAGE = `🎉 [업데이트 안내 (9/4 11:40)]
- 빈 배역 칸 삭제 가능하도록 기능 추가
- 캐스팅보드 읽기 정확도 개선
- 첫공/막공 등 이벤트 등록 시 제외 회차가 저장 안 되던 문제 수정
- 뒤로가기 눌렀을 때 앱이 그대로 꺼지던 문제 수정
- 배우 검색 시 같은 배우가 중복으로 뜨던 문제 정리
- 첫공/막공 시간이 헷갈릴 수 있는 경우 저장 전 확인하도록 개선`;
