"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { CURRENT_UPDATE_ID, UPDATE_NOTICE_MESSAGE } from "@/lib/site";

const STORAGE_KEY = "seen-update-id";

export const UpdateToast = () => {
  useEffect(() => {
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
