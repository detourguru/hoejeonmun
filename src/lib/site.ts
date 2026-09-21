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

export const CURRENT_UPDATE_ID = "2026-09-21";
export const UPDATE_NOTICE_MESSAGE = `🎉 [업데이트 안내 (9/21)]
- 검색에서 종료된 공연도 "공연완료" 상태로 찾을 수 있도록 수정
- 직접 등록한 공연이 기간이 끝난 뒤에도 "공연중"으로 표시되던 문제 수정
- 직접 등록한 공연을 등록한 사람이 공연 상세에서 수정할 수 있도록 추가
- 캐스팅 캘린더에서 날짜를 눌렀을 때 캐스팅이 이벤트보다 위에 보이도록 변경
- 이벤트에 회차를 추가/제외할 때 시계 대신 그날의 실제 공연 시간 중에서 고를 수 있도록 개선
- "첫공 무대인사"처럼 이름에 첫공/막공이 들어간 이벤트까지 첫공/막공 색으로 칠해지던 문제 수정, 프리뷰는 별도 색으로 표시
- 내 공연 화면에서 내가 담은 공연 달력과 애정배우 달력을 탭으로 나눠 따로 볼 수 있도록 변경
- 달력의 이벤트·배우 색과 공연 상태 뱃지를 무지개색 대신 서비스 색(남색/노랑)에 맞춘 차분한 색으로 정리`;
