# 최근 이슈 #141 / #138 적용 및 검증

## #141 운영자 조치

- 삭제 기본값은 해당 업로드 1건. 전체 삭제와 업로드 밴은 독립 선택.
- 사용자 ID, 업로드 ID 목록, 공연 수를 미리 확인하고 사유를 입력한다.
- 확인 이후 대상 업로드가 달라졌으면 실행하지 않고 다시 확인한다.
- 밴 범위는 이미지 업로드/파싱/저장/직접 등록. 로그인·정정·신고는 유지한다.
- 기존처럼 업로드 삭제는 영구 삭제다. 복구 기간은 도입하지 않는다.
- 다른 사용자의 캐스팅/이벤트/담은 회차를 보존하기 위해 공유 slots/event_groups는 삭제하지 않는다.
- DB 삭제·밴·감사 이력·이미지 정리 큐 기록은 단일 트랜잭션이다.
- 일부 DB 삭제 실패 시 전체 롤백한다. Storage 실패는 큐에 남겨 기존 일일 정리 크론 또는 운영 화면에서 재시도한다.
- `/mypage/moderation`에서 최근 조치/밴 목록/해제/이미지 재시도를 제공한다.
- 새 migration을 먼저 적용해야 새 앱 코드가 동작한다.

## #138 페이티드 = FATED

운영 DB 인증 정보가 없어 실제 원본/대상 데이터를 확인하거나 합치지는 않았다.
대상을 추측해 자동 병합하지 않는다. 다음 명령은 기간/공연장까지 비교하고
명시적으로 선택한 후보만 통합한다.

```sh
node --env-file=.env.local --conditions=react-server --import tsx scripts/merge-user-show.ts
node --env-file=.env.local --conditions=react-server --import tsx scripts/merge-user-show.ts TARGET_ID
node --env-file=.env.local --conditions=react-server --import tsx scripts/merge-user-show.ts TARGET_ID --apply
```

기존 통합 코드의 `event_slots.id` 조회(존재하지 않는 열), `slot_variants` 유실,
정정 이력·파싱 결과 미이동, 단계별 부분 커밋을 단일 RPC로 교체했다.
중복 이미지 hash처럼 충돌을 자동 해결할 수 없으면 전체 롤백한다.
원본 링크는 통합 공연 상세로 이동한다. 실제 통합 후 원본/대상 페이지와 검색을 확인한다.
KOPIS 자동 병합도 같은 RPC를 사용한다.

## 로컬 DB 검증

격리된 PostgreSQL 17에서 `supabase/tests/bootstrap.sql`, 전체 migration을 순서대로 적용한 다음
`upload_moderation.sql`, `merge_user_show.sql`을 실행한다. bootstrap은 Supabase의 auth/storage 최소 구조만 재현한다.
운영 Supabase 프로젝트나 실제 사용자 데이터에 쓰지 않는다.
