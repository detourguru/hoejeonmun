-- 원본 캡처는 회차 상세의 "원본 보기"로 누구나 봐야 하므로 공개 버킷이다.
--
-- TODO: 실사용자 업로드가 시작되기 전에 private으로 전환할 것.
-- 캐스팅보드는 제작사 저작물이라 공개 버킷이면 우리가 무기한 공개 재배포하는 셈이고
-- 검색엔진에도 노출된다. private + 단기 서명 URL(createSignedUrl)로 바꾸면
-- 열람 성격이 유지되고, 신고로 내려간 이미지 접근도 막을 수 있다.
-- 전환 시 함께 바뀌는 것: storage select 정책 추가, uploads.url이 URL 대신
-- 경로를 담게 되므로 storage_path로 개명.
-- 단, 이걸로 리플레이(옛 보드 재업로드)는 막지 못한다. 그건 이미지 해시가 답.
insert into storage.buckets (id, name, public)
values ('casting-boards', 'casting-boards', true)
on conflict (id) do nothing;

-- 이미지가 크면 Vercel 요청 본문 제한(4.5MB)에 걸려 서버를 못 거치므로
-- 브라우저에서 Storage로 직접 올린다. 그래서 여기에 insert 정책이 필요하다.
-- 경로 첫 칸을 uid로 강제해 남의 폴더에 못 쓰게 한다.
create policy "users upload own casting boards" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'casting-boards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
