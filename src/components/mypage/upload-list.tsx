import Image from "next/image";
import Link from "next/link";

import { OriginalImages } from "@/components/casting/original-images";
import { DeleteMineButton } from "@/components/delete-mine-button";
import type { MyUpload } from "@/service/mypage";

export const UploadList = ({ uploads }: { uploads: MyUpload[] }) => {
  if (uploads.length === 0) {
    return (
      <p className="text-text-muted py-8 text-center text-sm">
        아직 올린 캐스팅보드가 없어요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {uploads.map((upload) => (
        <li
          key={upload.id}
          className="border-border bg-surface flex gap-3 rounded-xl border p-3 shadow-sm"
        >
          {upload.images[0] && (
            <Image
              src={upload.images[0]}
              alt=""
              width={56}
              height={56}
              className="border-border h-14 w-14 shrink-0 rounded-lg border object-cover"
            />
          )}

          <div className="flex flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/show/${upload.showId}`}
                className="text-text hover:text-primary text-sm font-bold underline-offset-2 hover:underline"
              >
                {upload.showName}
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-text-muted text-[10px]">
                  {upload.createdAt.slice(0, 10)}
                </span>
                <DeleteMineButton
                  target={{
                    kind: "upload",
                    showId: upload.showId,
                    uploadId: upload.id,
                  }}
                  label={upload.showName}
                />
              </div>
            </div>

            <OriginalImages images={upload.images} />
          </div>
        </li>
      ))}
    </ul>
  );
};
