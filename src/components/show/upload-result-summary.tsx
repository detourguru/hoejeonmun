"use client";

import { useState } from "react";

import { CastingBoardResult, PERFORMANCE_SKIP_MESSAGE } from "@/type/casting";

export const UploadResultSummary = ({
  result,
}: {
  result: CastingBoardResult;
}) => {
  const [showSkipped, setShowSkipped] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <p className="text-text text-xs">
        회차 {result.slotCount}개, 배우 {result.actorCount}명, 이벤트{" "}
        {result.eventCount}건을 저장했어요.
      </p>

      {result.skippedCount > 0 && (
        <div className="text-text-muted flex flex-col gap-1 text-xs">
          <p>
            {result.skippedCount}개 행은 확인하지 못해 제외했어요.{" "}
            <button
              type="button"
              onClick={() => setShowSkipped((prev) => !prev)}
              className="underline underline-offset-2"
            >
              {showSkipped ? "접기" : "보기"}
            </button>
          </p>

          {showSkipped && (
            <ul className="flex flex-col gap-1 text-[11px]">
              {result.skipped.map((row, index) => (
                <li key={index}>
                  {row.imageIndex + 1}번째 이미지 — {row.raw.date || "날짜"}{" "}
                  {row.raw.time || ""}· {PERFORMANCE_SKIP_MESSAGE[row.reason]}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
