import Image from "next/image";
import Link from "next/link";

import { ShowDetail } from "@/type/show";
import { Badge } from "../ui/badge";
import { StateBadge } from "./state-badge";
import { normalizeDate } from "@/lib/date";

export const RecentCastingCard = ({
  show,
  uploadedAt,
}: {
  show: ShowDetail;
  uploadedAt: string;
}) => {
  return (
    <Link
      href={`/show/${show.mt20id}/castings`}
      className="mb-4 flex gap-3 overflow-hidden rounded border p-4 transition-colors hover:bg-point/20"
    >
      {show.poster ? (
        <Image
          width="100"
          height="150"
          className="rounded object-cover w-24 h-32"
          src={show.poster}
          alt={show.prfnm}
        />
      ) : (
        <div className="w-24 h-32 shrink-0 rounded bg-point/40" />
      )}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex gap-1 min-w-0">
          <Badge variant="outline">{show.genrenm}</Badge>
          <StateBadge state={show.prfstate} />
        </div>
        <div title={show.prfnm} className="truncate text-text font-bold">
          {show.prfnm}
        </div>
        <p className="text-xs text-text-muted">{show.fcltynm}</p>
        <p className="text-xs text-muted-foreground">
          {normalizeDate(uploadedAt.slice(0, 10), ".")} 캐스팅보드 업로드
        </p>
      </div>
    </Link>
  );
};
