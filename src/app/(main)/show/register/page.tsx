import { BackButton } from "@/components/back-button";
import { RegisterShowForm } from "@/components/show/register-show-form";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "공연 등록 | 회전문",
  robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<{ title?: string }> };

export default async function Page({ searchParams }: Props) {
  const { title } = await searchParams;

  return (
    <div className="flex flex-col gap-4">
      <BackButton />

      <div className="flex flex-col gap-1">
        <h1 className="text-text text-lg font-bold">공연 등록</h1>
        <p className="text-text-muted text-xs">
          KOPIS에 아직 등록되지 않은 공연을 직접 올릴 수 있어요. &ldquo;사용자
          등록 공연&rdquo;으로 표시돼요.
        </p>
      </div>

      <RegisterShowForm initialTitle={title} />
    </div>
  );
}
