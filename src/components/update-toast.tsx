"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { getToday, toInputDate } from "@/lib/date";
import {
  CURRENT_UPDATE_ID,
  isUpdateNoticeActive,
  UPDATE_NOTICE_MESSAGE,
} from "@/lib/site";

const STORAGE_KEY = "seen-update-id";

export const UpdateToast = () => {
  useEffect(() => {
    if (!isUpdateNoticeActive(CURRENT_UPDATE_ID, toInputDate(getToday()))) {
      return;
    }

    const seenUpdateId = localStorage.getItem(STORAGE_KEY);

    if (seenUpdateId === CURRENT_UPDATE_ID) return;

    toast(UPDATE_NOTICE_MESSAGE, {
      duration: Infinity,
      style: { whiteSpace: "pre-line" },
      onDismiss: () => localStorage.setItem(STORAGE_KEY, CURRENT_UPDATE_ID),
    });
  }, []);

  return null;
};
