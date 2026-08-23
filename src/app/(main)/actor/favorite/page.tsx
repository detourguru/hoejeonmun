import Link from "next/link";

import { getFavoriteActors } from "@/service/actor";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "애정배우 | 회전문",
};

// 비로그인 접근은 proxy에서 /login으로 보낸다
export default async function Page() {
  const actors = await getFavoriteActors();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-text text-lg font-bold">애정배우</h2>

      {actors.length === 0 ? (
        <p className="text-text-muted py-16 text-center text-sm">
          아직 담아둔 배우가 없어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {actors.map(({ id, name }) => (
            <li key={id}>
              <Link
                href={`/actor/${id}`}
                className="border-border bg-surface text-text hover:bg-point flex rounded-lg border p-3 text-sm transition-colors"
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
