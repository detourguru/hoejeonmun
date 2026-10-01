"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TUTORIAL_SEEN_KEY = "uploadTutorialSeen";

export const UploadTutorialDialog = ({
  isLoggedIn,
}: {
  isLoggedIn: boolean;
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isLoggedIn && !localStorage.getItem(TUTORIAL_SEEN_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
    }
  }, [isLoggedIn]);

  const handleConfirm = () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleConfirm();
      }}
    >
      <DialogContent showCloseButton={false} className="bg-surface">
        <DialogHeader>
          <DialogTitle>캐스팅/이벤트 제보하는 방법</DialogTitle>
        </DialogHeader>

        <ol className="text-text list-decimal space-y-1 pl-4 text-left text-sm">
          <li>페이지 하단의 캐스팅보드/이벤트 제보하기 버튼을 누릅니다</li>
          <li>캐스팅보드나 이벤트 이미지를 첨부하면</li>
          <li>AI가 사진을 읽어서 자동으로 정리하고</li>
          <li>회원님이 내용을 확인/수정한 뒤</li>
          <li>저장하면 바로 반영돼요</li>
          <li>잘못된 정보는 정정하거나 신고할 수 있어요</li>
        </ol>

        <p className="text-text-muted text-xs">
          AI가 사진을 읽다 보니 정확도가 아직 완벽하진 않아요. 계속 개선하고
          있으니 양해 부탁드려요.
        </p>

        <DialogFooter>
          <Button onClick={handleConfirm} className="w-full font-bold">
            확인했어요
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
