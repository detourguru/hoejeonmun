import Image from "next/image";
import Link from "next/link";

import type { RecentEvent } from "@/service/casting";
import { ShowDetail } from "@/type/show";
import { normalizeDate } from "@/lib/date";

export const RecentEventCard = ({
  show,
  event,
}: {
  show: ShowDetail;
  event: RecentEvent;
}) => {
  const month = event.periodStart.slice(0, 7);

  return (
    <Link
      href={`/show/${show.mt20id}/castings?month=${month}&date=${event.periodStart}`}
      className="group flex gap-3 rounded-xl border border-border bg-surface p-3 transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="w-24 h-32 shrink-0 overflow-hidden rounded-lg bg-point/40">
        {show.poster && (
          <Image
            width="100"
            height="150"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            src={show.poster}
            alt={show.prfnm}
          />
        )}
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <p title={show.prfnm} className="truncate text-xs text-text-muted">
          {show.prfnm}
        </p>
        <div title={event.title} className="truncate text-text font-bold">
          {event.title}
        </div>
        {event.description && (
          <p className="line-clamp-2 text-xs text-text-muted">
            {event.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {normalizeDate(event.periodStart.slice(0, 10), ".")} -{" "}
          {normalizeDate(event.periodEnd.slice(0, 10), ".")}
        </p>
      </div>
    </Link>
  );
};
