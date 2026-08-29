"use client";

import { ChevronRight, Download, Share, SquarePlus } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { BottomSheet } from "@/components/bottom-sheet";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const noSubscription = () => () => {};

const getIsIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);

const getIsStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as unknown as { standalone?: boolean }).standalone === true;

const useIsIOS = () =>
  useSyncExternalStore(noSubscription, getIsIOS, () => false);

const useIsStandalone = () =>
  useSyncExternalStore(noSubscription, getIsStandalone, () => false);

export const InstallGuideButton = () => {
  const [open, setOpen] = useState(false);
  const isIOS = useIsIOS();
  const isStandalone = useIsStandalone();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
  }, []);

  if (isStandalone) return null;

  const handleClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } finally {
        setDeferredPrompt(null);
      }
      return;
    }

    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="hover:bg-sub flex w-full items-center gap-3 p-3 text-left transition-colors"
      >
        <span className="bg-text-muted/10 flex size-9 shrink-0 items-center justify-center rounded-full">
          <Download className="text-text-muted size-4" />
        </span>
        <span className="text-text flex-1 text-sm font-bold">
          앱 설치하기
        </span>
        <ChevronRight className="text-text-muted size-4 shrink-0" />
      </button>

      <BottomSheet open={open} onOpenChange={setOpen} title="앱 설치 방법">
        {isIOS ? (
          <ol className="flex flex-col gap-3">
            <GuideStep index={1}>
              하단 메뉴에서 공유 버튼(
              <Share className="text-text mx-1 inline size-4" />
              )을 탭하세요
            </GuideStep>
            <GuideStep index={2}>
              메뉴에서 &quot;홈 화면에 추가&quot;(
              <SquarePlus className="text-text mx-1 inline size-4" />
              )를 선택하세요
            </GuideStep>
            <GuideStep index={3}>
              오른쪽 위 &quot;추가&quot;를 눌러 완료하세요
            </GuideStep>
          </ol>
        ) : (
          <ol className="flex flex-col gap-3">
            <GuideStep index={1}>브라우저 메뉴(⋮ 또는 …)를 여세요</GuideStep>
            <GuideStep index={2}>
              &quot;앱 설치&quot; 또는 &quot;홈 화면에 추가&quot;를 선택하세요
            </GuideStep>
          </ol>
        )}
      </BottomSheet>
    </>
  );
};

const GuideStep = ({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) => (
  <li className="flex items-start gap-2.5">
    <span className="bg-point/40 text-primary flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold">
      {index}
    </span>
    <span className="text-text pt-0.5 text-sm leading-relaxed">{children}</span>
  </li>
);
