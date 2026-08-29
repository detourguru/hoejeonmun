import { Coffee } from "lucide-react";

const KAKAOPAY_URL = "https://qr.kakaopay.com/Ej8JgPqvy";

export const DonateButton = () => (
  <div className="flex w-full flex-col items-center gap-1">
    <a
      href={KAKAOPAY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="border-border text-text-muted hover:border-primary/40 hover:text-primary flex w-full items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-colors"
    >
      <Coffee className="size-3.5" />
      개발자에게 커피 사주기
    </a>
    <p className="text-text-muted text-[10px]">
      회전문을 계속 운영하고 개선하는 데 도움이 됩니다
    </p>
  </div>
);
