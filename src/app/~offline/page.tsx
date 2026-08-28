export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center text-white">
      <h1 className="text-lg font-semibold">오프라인 상태예요</h1>
      <p className="text-sm text-white/70">
        인터넷 연결을 확인한 뒤 다시 시도해주세요.
      </p>
    </main>
  );
}
