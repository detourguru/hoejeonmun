import Image from "next/image";
import Link from "next/link";

import { formatShortDate } from "@/lib/date";
import { Show } from "@/type/show";

import { Badge } from "../ui/badge";

import { StateBadge } from "./state-badge";

export const ShowCard = ({
  show,
  lastUpdatedAt,
  priority = false,
}: {
  show: Show;
  lastUpdatedAt?: string | null;
  priority?: boolean;
}) => {
  return (
    <Link
      href={`/show/${show.mt20id}`}
      className="hover:bg-point/20 mb-4 flex gap-3 overflow-hidden rounded border p-4 transition-colors"
    >
      {show.poster ? (
        <Image
          width="100"
          height="150"
          sizes="96px"
          priority={priority}
          className="h-32 w-24 rounded object-cover"
          src={show.poster}
          alt={show.prfnm}
        />
      ) : (
        <div className="bg-point/40 h-32 w-24 shrink-0 rounded" />
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 gap-1">
          <Badge variant="outline">{show.genrenm}</Badge>
          <StateBadge state={show.prfstate} />
        </div>
        <div title={show.prfnm} className="text-text truncate font-bold">
          {show.prfnm}
        </div>
        <p className="text-text-muted text-xs">{show.fcltynm}</p>
        <p className="text-muted-foreground text-xs">
          {show.prfpdfrom} - {show.prfpdto}
        </p>
        {lastUpdatedAt !== undefined && (
          <Badge
            variant={lastUpdatedAt ? "secondary" : "outline"}
            className="mt-1"
          >
            {lastUpdatedAt
              ? `캐스팅보드 ${formatShortDate(lastUpdatedAt)} 업데이트`
              : "캐스팅보드 없음"}
          </Badge>
        )}
      </div>
    </Link>
  );
};
