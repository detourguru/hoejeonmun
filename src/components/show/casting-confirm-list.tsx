"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CAST_MISMATCH_WARNING, ParsedPerformance } from "@/type/casting";

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
      Object.entries(performance.casting).map(([role, actors]) => [
        role === oldRole ? newRole : role,
        actors,
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
      Object.entries(performance.casting).map(([role, actors]) => [
        role,
        actors.map((actor) => (actor === oldActor ? newActor : actor)),
      ]),
    );

    return { performance: { ...performance, casting }, include };
  });

const uniqueRoles = (drafts: CastingDraft[]) => [
  ...new Set(
    drafts.flatMap(({ performance }) => Object.keys(performance.casting)),
  ),
];

const uniqueActors = (drafts: CastingDraft[]) => [
  ...new Set(
    drafts.flatMap(({ performance }) =>
      Object.values(performance.casting).flat(),
    ),
  ),
];

export const CastingConfirmList = ({
  drafts,
  onChange,
}: {
  drafts: CastingDraft[];
  onChange: (drafts: CastingDraft[]) => void;
}) => {
  const roles = uniqueRoles(drafts);
  const actors = uniqueActors(drafts);
  const [expanded, setExpanded] = useState(false);

  const updateDraft = (index: number, next: Partial<CastingDraft>) =>
    onChange(
      drafts.map((draft, at) => (at === index ? { ...draft, ...next } : draft)),
    );

  const updatePerformance = (index: number, next: Partial<ParsedPerformance>) =>
    updateDraft(index, {
      performance: { ...drafts[index].performance, ...next },
    });

  const updateActor = (
    index: number,
    role: string,
    actorIndex: number,
    value: string,
  ) => {
    const casting = { ...drafts[index].performance.casting };

    casting[role] = casting[role].map((actor, at) =>
      at === actorIndex ? value : actor,
    );

    updatePerformance(index, { casting });
  };

  const addActor = (index: number, role: string) => {
    const casting = { ...drafts[index].performance.casting };

    casting[role] = [...casting[role], ""];

    updatePerformance(index, { casting });
  };

  const removeActor = (index: number, role: string, actorIndex: number) => {
    const casting = { ...drafts[index].performance.casting };
    const remaining = casting[role].filter((_, at) => at !== actorIndex);

    if (remaining.length === 0) {
      delete casting[role];
    } else {
      casting[role] = remaining;
    }

    updatePerformance(index, { casting });
  };

  const addRole = (index: number) => {
    const casting = { ...drafts[index].performance.casting };

    let role = "새 배역";
    let n = 1;

    while (role in casting) role = `새 배역 ${++n}`;

    casting[role] = [""];

    updatePerformance(index, { casting });
  };

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

  const needsReview = (performance: ParsedPerformance) =>
    performance.confidence < CONFIDENCE_THRESHOLD || performance.castMismatch;

  const lowConf = ordered.filter((order) =>
    needsReview(order.draft.performance),
  );
  const highConf = ordered.filter(
    (order) => !needsReview(order.draft.performance),
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

        {performance.castMismatch && (
          <p className="text-destructive text-xs">{CAST_MISMATCH_WARNING}</p>
        )}

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

        <ul className="flex flex-col gap-1.5">
          {Object.entries(performance.casting).map(([role, actors]) => (
            <li key={role} className="flex flex-col gap-1">
              <span className="text-text-muted text-[11px] font-bold">
                {role}
              </span>

              {actors.map((actor, actorIndex) => (
                <div key={actorIndex} className="flex items-center gap-1">
                  <Input
                    value={actor}
                    disabled={!include}
                    aria-label={`${role} 배우명`}
                    className="h-7 text-xs"
                    onChange={({ target }) =>
                      updateActor(index, role, actorIndex, target.value)
                    }
                  />
                  <button
                    type="button"
                    disabled={!include}
                    onClick={() => removeActor(index, role, actorIndex)}
                    className="text-text-muted hover:text-destructive inline-flex w-fit shrink-0 rounded-4xl px-2 py-1 text-[11px] transition-colors disabled:opacity-60"
                  >
                    삭제
                  </button>
                </div>
              ))}

              <button
                type="button"
                disabled={!include}
                onClick={() => addActor(index, role)}
                className="text-text-muted hover:text-primary inline-flex w-fit shrink-0 rounded-4xl px-2 py-1 text-[11px] transition-colors disabled:opacity-60"
              >
                + 배우 추가
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          disabled={!include}
          onClick={() => addRole(index)}
          className="text-text-muted hover:text-primary inline-flex w-fit shrink-0 rounded-4xl px-2 py-1 text-[11px] underline underline-offset-2 transition-colors disabled:opacity-60"
        >
          + 배역 추가
        </button>
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
