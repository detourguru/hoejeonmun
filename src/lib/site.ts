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

export const CURRENT_UPDATE_ID = "2026-09-28";
export const UPDATE_NOTICE_MESSAGE = `🎉 [업데이트 안내 (9/28)]
- 이벤트 설명에서 줄바꿈한 내용이 한 줄로 붙어 보이던 문제 수정
- 캐스팅보드에 에피소드·버전(예: 더 헬멧의 ROOM SEOUL/ROOM ALEPPO)이 적힌 공연은 회차 옆에 함께 표시하고, 정정 제안에서 고칠 수 있도록 추가
- 앞 공연이 끝나는 시각에 바로 시작하는 공연도 내 일정에서 시간이 겹친다고 표시되도록 수정`;
