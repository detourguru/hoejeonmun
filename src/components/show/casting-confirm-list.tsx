"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ParsedPerformance } from "@/type/casting";

const CONFIDENCE_THRESHOLD = 0.7;

export type CastingDraft = {
  performance: ParsedPerformance;
  include: boolean;
};

export const toCastingDrafts = (
  performances: ParsedPerformance[],
): CastingDraft[] =>
  performances.map((performance) => ({ performance, include: true }));

export const toConfirmedPerformances = (
  drafts: CastingDraft[],
): ParsedPerformance[] =>
  drafts.filter(({ include }) => include).map(({ performance }) => performance);

const renameRole = (
  drafts: CastingDraft[],
  oldRole: string,
  newRole: string,
): CastingDraft[] =>
  drafts.map(({ performance, include }) => {
    if (!(oldRole in performance.casting)) return { performance, include };

    const casting = Object.fromEntries(
      Object.entries(performance.casting).map(([role, actor]) => [
        role === oldRole ? newRole : role,
        actor,
      ]),
    );

    return { performance: { ...performance, casting }, include };
  });

const renameActor = (
  drafts: CastingDraft[],
  oldActor: string,
  newActor: string,
): CastingDraft[] =>
  drafts.map(({ performance, include }) => {
    const casting = Object.fromEntries(
      Object.entries(performance.casting).map(([role, actor]) => [
        role,
        actor === oldActor ? newActor : actor,
      ]),
    );

    return { performance: { ...performance, casting }, include };
  });

const uniqueValues = (drafts: CastingDraft[], pick: 0 | 1) => [
  ...new Set(
    drafts
      .flatMap(({ performance }) => Object.entries(performance.casting))
      .map((entry) => entry[pick]),
  ),
];

export const CastingConfirmList = ({
  drafts,
  onChange,
}: {
  drafts: CastingDraft[];
  onChange: (drafts: CastingDraft[]) => void;
}) => {
  const roles = uniqueValues(drafts, 0);
  const actors = uniqueValues(drafts, 1);
  const [expanded, setExpanded] = useState(false);

  const updateDraft = (index: number, next: Partial<CastingDraft>) =>
    onChange(
      drafts.map((draft, at) => (at === index ? { ...draft, ...next } : draft)),
    );

  const updatePerformance = (index: number, next: Partial<ParsedPerformance>) =>
    updateDraft(index, {
      performance: { ...drafts[index].performance, ...next },
    });

  // 원래 drafts 배열 인덱스는 그대로 유지해서 수정 시 매핑에 쓴다
  const ordered = drafts
    .map((draft, index) => ({ draft, index }))
    .sort((a, b) => {
      const { date: dateA, time: timeA } = a.draft.performance;
      const { date: dateB, time: timeB } = b.draft.performance;

      return dateA === dateB
        ? timeA.localeCompare(timeB)
        : dateA.localeCompare(dateB);
    });

  const lowConf = ordered.filter(
    (order) => order.draft.performance.confidence < CONFIDENCE_THRESHOLD,
  );
  const highConf = ordered.filter(
    (order) => order.draft.performance.confidence >= CONFIDENCE_THRESHOLD,
  );

  const renderCard = (
    { performance, include }: CastingDraft,
    index: number,
  ) => {
    return (
      <li
        key={index}
        className="border-border flex flex-col gap-2 rounded-lg border p-3"
      >
        <label className="text-text flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={include}
            onChange={({ target }) =>
              updateDraft(index, { include: target.checked })
            }
          />
          이 회차를 저장할게요
        </label>

        <div className="flex items-center gap-1">
          <Input
            type="date"
            value={performance.date}
            disabled={!include}
            aria-label="날짜"
            onChange={({ target }) =>
              updatePerformance(index, { date: target.value })
            }
          />
          <Input
            type="time"
            value={performance.time}
            disabled={!include}
            aria-label="시간"
            onChange={({ target }) =>
              updatePerformance(index, { time: target.value })
            }
          />
        </div>

        <ul className="text-text-muted flex flex-col gap-0.5 text-xs">
          {Object.entries(performance.casting).map(([role, actor]) => (
            <li key={role}>
              {role}: {actor}
            </li>
          ))}
        </ul>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {(roles.length > 0 || actors.length > 0) && (
        <div className="border-border flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-text-muted text-[10px] font-bold">
            배역/배우명을 고치면 모든 회차에 한 번에 반영돼요
          </p>

          {roles.length > 0 && (
            <ul className="flex flex-col gap-1">
              {roles.map((role, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="text-text-muted w-10 shrink-0 text-xs">
                    배역
                  </span>
                  <Input
                    value={role}
                    aria-label="배역명"
                    onChange={({ target }) =>
                      onChange(renameRole(drafts, role, target.value))
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          {actors.length > 0 && (
            <ul className="flex flex-col gap-1">
              {actors.map((actor, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="text-text-muted w-10 shrink-0 text-xs">
                    배우
                  </span>
                  <Input
                    value={actor}
                    aria-label="배우명"
                    onChange={({ target }) =>
                      onChange(renameActor(drafts, actor, target.value))
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {lowConf.map(({ draft, index }) => renderCard(draft, index))}
      </ul>
      {highConf.length > 0 && (
        <Button onClick={() => setExpanded(!expanded)}>
          {highConf.length}건 자동확정
        </Button>
      )}
      {expanded && (
        <ul className="flex flex-col gap-3">
          {highConf.map(({ draft, index }) => renderCard(draft, index))}
        </ul>
      )}
    </div>
  );
};
