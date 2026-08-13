import type { Metadata } from "next";
import Link from "next/link";

import { getFavoriteActors } from "@/service/actor";

export const metadata: Metadata = {
  title: "애정배우 | 회전문",
};

// 비로그인 접근은 proxy에서 /login으로 보낸다
export default async function Page() {
  const actors = await getFavoriteActors();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-text">애정배우</h2>

      {actors.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-muted">
          아직 담아둔 배우가 없어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {actors.map(({ id, name }) => (
            <li key={id}>
              <Link
                href={`/actor/${id}`}
                className="flex rounded-lg border border-border bg-surface p-3 text-sm text-text transition-colors hover:bg-point"
              >
                {name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
