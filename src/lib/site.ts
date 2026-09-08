// 커스텀 도메인 연결 전까지는 Vercel 프로덕션 도메인을 그대로 사용한다.
// 도메인을 연결하면 VERCEL_PROJECT_PRODUCTION_URL 값이 그 도메인으로 바뀌므로 코드 변경 없이 반영된다.
const PRODUCTION_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_NAME = "회전문";
export const SITE_URL = PRODUCTION_URL
  ? `https://${PRODUCTION_URL}`
  : "http://localhost:3000";
export const SITE_DESCRIPTION =
  "놓치기 아까운 공연 이벤트부터 회차 관리까지 회전문에서 한번에";

export const CURRENT_UPDATE_ID = "2026-09-08";
export const UPDATE_NOTICE_MESSAGE = `🎉 [업데이트 안내 (9/8)]
- 캐스팅보드 추가 시 일부 회차가 누락되던 문제 수정
- 캐스팅 정정 시 배우명이 비어서 저장되던 문제 수정
- 이벤트 적용 회차 계산 정확도 개선
- 내 즐겨찾기에 담은 이벤트 기간이 북마크 시점으로 고정 표시되던 문제 수정
- 검색 결과가 없을 때 공연을 직접 등록할 수 있는 기능 추가
- 원캐스트 등 캐스팅보드 이미지 없이 일정/배역/배우를 직접 등록하는 기능 추가
- 캐스팅 캘린더 하루 표시 회차 수 확대 (2개 → 3개)
- 첫공/막공 이벤트를 다른 이벤트와 색으로 구분 표시
- 캐스팅 캘린더 헤더에서 연/월 직접 선택 가능
- 애정배우 일정 모아보기 기능 추가
- 캐스팅보드 저장 속도 개선`;
