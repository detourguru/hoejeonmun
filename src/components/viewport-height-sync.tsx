"use client";

import { useEffect } from "react";

export const ViewportHeightSync = () => {
  useEffect(() => {
    const setHeight = () => {
      document.documentElement.style.setProperty(
        "--app-height",
        `${window.innerHeight}px`,
      );
    };

    setHeight();

    window.addEventListener("resize", setHeight);
    window.addEventListener("orientationchange", setHeight);
    window.addEventListener("pageshow", setHeight);
    document.addEventListener("visibilitychange", setHeight);

    return () => {
      window.removeEventListener("resize", setHeight);
      window.removeEventListener("orientationchange", setHeight);
      window.removeEventListener("pageshow", setHeight);
      document.removeEventListener("visibilitychange", setHeight);
    };
  }, []);

  return null;
};
