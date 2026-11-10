# Storage 정리 및 압축

## 정리 기준

`storage_cleanup_candidates(1000)`은 Storage 메타데이터를 읽기만 한다.
객체 생성일과 최종 수정일이 모두 7일 이상 지난 파일만 선택한다.

- casting-boards: upload_images, casting_parse_results가 참조하는 경로 및 최근 7일 파싱 실패 경로를 보존한다.
- show-posters: 현재 user_shows 포스터 및 활성 공연의 썸네일 원본 참조를 보존한다. 삭제된 local 공연의 낡은 썸네일 캐시는 현재 공연 참조로 취급하지 않는다.
- poster-thumbnails: poster_thumbnails.path에 등록된 파일은 보존한다.
- bug-report-images: 자동 삭제 대상에서 제외한다.

실제 파일 삭제는 Edge Function에서 Storage API로 수행한다. SQL로 storage.objects를 삭제하지 않는다.
한 번에 100개씩, 최대 1000개를 처리한다. 오류가 나면 실패를 반환하고 다음 실행 때 미완료 파일을 다시 선택한다.
정리 결과는 함수 로그에 버킷별 건수/바이트로 남긴다. 기존 Vercel 파싱 실패 정리도 같은 참조 확인을 거쳐, 실패 기록 이후 정상 저장된 원본을 삭제하지 않도록 보완했다.

## 인증과 배포

새 인증 설계는 사용자 승인 후에만 적용한다.

1. Vault에 무작위 256비트 storage_maintenance_token을 한 번 생성한다.
2. 원문을 노출하지 않고 SHA-256 해시만 조회하여 함수의 __TOKEN_SHA256__ 자리로 배포한다.
3. verify_jwt=false는 함수 자체의 전용 bearer 검증을 사용하기 때문이다. 익명 요청은 401로 거부한다.
4. 임시 compression_urls 기능은 2시간 이내로 제한하고 압축 작업 후 함수에서 제거한다.
5. 배포와 수동 실행이 확인되면 schedule_storage_maintenance migration을 적용한다.
6. daily job은 UTC 19:45 (KST 04:45)에 실행한다. 토큰 원문은 Vault에서만 읽는다.

이 작업의 조회 함수 migration 2개는 이미 운영 DB에 적용했다.
배포/인증키/스케줄 생성은 별도 승인이 있기 전에는 실행하지 않는다.

## 기존 대용량 이미지 압축

`src/lib/storage-image-compression.ts`는 Sharp를 사용한다.

- 5MiB 초과 파일을 대상으로 WebP 무손실 인코딩을 먼저 시도한다.
- 폭이나 높이가 WebP의 16383px 제한을 넘으면 무손실 PNG로 인코딩한다.
- 해상도는 줄이지 않는다. 방향 정보를 반영하고 sRGB로 변환한 표시 픽셀과 결과 픽셀을 대조한다.
- 1KiB 이상 작아지지 않으면 원본을 유지한다. 애니메이션은 건너뛴다.
- 교체 전 원본을 로컬 전용 백업 디렉터리에 보관한다. URL과 Storage 경로는 유지한다.
- image_hash는 원래 업로드 바이트에 대한 중복 방지 키로 유지한다. 압축 때문에 재작성하지 않는다.
- 기존 경로의 CDN 캐시는 늦게 갱신될 수 있다. 새 URL이 필요한 후속 설계에서는 경로 변경과 DB 참조 이동을 원자적으로 처리해야 한다.

```sh
NODE_USE_ENV_PROXY=1 npx tsx scripts/compress-storage-images.ts /tmp/storage-signed.json
NODE_USE_ENV_PROXY=1 npx tsx scripts/compress-storage-images.ts /tmp/storage-signed.json --apply
```

서명 URL 목록은 공개하거나 커밋하지 않는다. 서비스 역할 키는 로컬로 내려받지 않는다.
원본 백업과 결과는 기본 /workspace/artifacts에 기록한다. 다른 환경에서는 STORAGE_MAINTENANCE_DIR로 경로를 지정한다.

## 저장 전 압축 조사

현재 브라우저는 고른 File을 그대로 Storage에 올린다. 서버의 Gemini용 resize는 분석 입력만 줄이고 Storage 원본 용량을 줄이지 않는다.

무료 플랜에서 추천하는 순서:

1. 브라우저에서 createImageBitmap + Canvas.toBlob으로 WebP 후보를 만든다. 품질 0.92 정도부터 실제 캐스팅 표의 작은 글자를 검증한다. 더 커지면 원본을 쓴다. Canvas의 WebP quality=1은 무손실을 보장하지 않으므로 무손실로 표시하면 안 된다.
2. iOS의 긴 이미지/메모리 제한, GIF/HEIC, EXIF 방향, 브라우저 인코딩 지원 여부를 처리한다. 캐스팅 표는 무조건 긴 변을 줄이지 않는다.
3. 서버에서도 MIME/디코딩/픽셀 수를 검증한다. 작은 파일 업로드용 서버 경로에서는 Sharp의 무손실 함수를 재사용할 수 있다.
4. 큰 파일은 Vercel 요청 본문 제한 때문에 기존 Storage 직접 업로드 후 서버 정규화 또는 서명 업로드 설계가 필요하다. 이 경우 임시 원본을 성공/실패 시 모두 정리해야 한다.
5. 압축 정책이 달라져도 중복 검출이 바뀌지 않도록 원본 해시와 저장 객체 해시의 의미를 구분한다.

Supabase의 on-the-fly Image Transformations는 Pro 이상이고, 변환본을 전송할 뿐 저장된 원본 크기를 줄이지 않는다. 이번 무료 Storage 절감의 해법으로 사용하지 않는다.

참고:
- https://supabase.com/docs/guides/functions/schedule-functions
- https://supabase.com/docs/guides/storage/schema/design
- https://supabase.com/docs/guides/storage/serving/image-transformations
