import Image from "next/image";
import Link from "next/link";

import { normalizeDate } from "@/lib/date";
import type { RecentEvent } from "@/service/casting";
import { ShowDetail } from "@/type/show";

export const RecentEventCard = ({
  show,
  event,
  priority = false,
}: {
  show: ShowDetail;
  event: RecentEvent;
  priority?: boolean;
}) => {
  const month = event.periodStart.slice(0, 7);

  return (
    <Link
      href={`/show/${show.mt20id}/castings?month=${month}&date=${event.periodStart}`}
      className="group border-border bg-surface hover:border-primary/40 flex gap-3 rounded-xl border p-3 transition-all hover:shadow-md"
    >
      <div className="bg-point/40 h-32 w-24 shrink-0 overflow-hidden rounded-lg">
        {show.poster && (
          <Image
            width="100"
            height="150"
            sizes="96px"
            priority={priority}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            src={show.poster}
            alt={show.prfnm}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p title={show.prfnm} className="text-text-muted truncate text-xs">
          {show.prfnm}
        </p>
        <div title={event.title} className="text-text truncate font-bold">
          {event.title}
        </div>
        {event.description && (
          <p className="text-text-muted line-clamp-2 text-xs">
            {event.description}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          {normalizeDate(event.periodStart.slice(0, 10), ".")} -{" "}
          {normalizeDate(event.periodEnd.slice(0, 10), ".")}
        </p>
      </div>
    </Link>
  );
};
