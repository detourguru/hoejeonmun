import Image from "next/image";
import Link from "next/link";

import { normalizeDate } from "@/lib/date";
import { ShowDetail } from "@/type/show";

import { Badge } from "../ui/badge";

import { StateBadge } from "./state-badge";

export const FavoriteActorShowCard = ({
  show,
  actorNames,
  nearestDate,
}: {
  show: ShowDetail;
  actorNames: string[];
  nearestDate: string;
}) => {
  const [firstActor, ...rest] = actorNames;
  const month = nearestDate.slice(0, 7);

  return (
    <Link
      href={`/show/${show.mt20id}/castings?month=${month}&date=${nearestDate}`}
      className="group border-primary/30 bg-surface hover:border-primary flex gap-3 rounded-xl border p-3 transition-all hover:shadow-md"
    >
      <div className="bg-point/40 h-32 w-24 shrink-0 overflow-hidden rounded-lg">
        {show.poster && (
          <Image
            width="100"
            height="150"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            src={show.poster}
            alt={show.prfnm}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 gap-1">
          <Badge variant="outline">{show.genrenm}</Badge>
          <StateBadge state={show.prfstate} />
        </div>
        <div title={show.prfnm} className="text-text truncate font-bold">
          {show.prfnm}
        </div>
        <p className="text-text-muted text-xs">{show.fcltynm}</p>
        <p className="text-primary text-xs font-medium">
          ♥ {firstActor}
          {rest.length > 0 ? ` 외 ${rest.length}명` : ""} 출연
        </p>
        <p className="text-muted-foreground text-xs">
          댜가오는 회차 · {normalizeDate(nearestDate, ".")}
        </p>
      </div>
    </Link>
  );
};
