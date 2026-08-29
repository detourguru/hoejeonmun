import { ChevronRight, Coffee } from "lucide-react";

const KAKAOPAY_URL = "https://qr.kakaopay.com/Ej8JgPqvy";

export const DonateButton = () => (
  <a
    href={KAKAOPAY_URL}
    target="_blank"
    rel="noopener noreferrer"
    className="hover:bg-sub flex items-center gap-3 p-3 transition-colors"
  >
    <span className="bg-text-muted/10 flex size-9 shrink-0 items-center justify-center rounded-full">
      <Coffee className="text-text-muted size-4" />
    </span>
    <span className="flex flex-1 flex-col">
      <span className="text-text text-sm font-bold">
        개발자에게 커피 사주기
      </span>
      <span className="text-text-muted text-[11px]">
        회전문을 계속 운영하고 개선하는 데 도움이 됩니다
      </span>
    </span>
    <ChevronRight className="text-text-muted size-4 shrink-0" />
  </a>
);
