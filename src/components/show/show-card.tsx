import { Show, StateName } from "@/type/show";
import Image from "next/image";
import { Badge } from "../ui/badge";

const BADGE_VARIANT_BY_STATE = {
  개막예정: "upcoming",
  진행중: "ongoing",
} as const satisfies Record<StateName, string>;

export const ShowCard = ({ show }: { show: Show }) => {
  return (
    <div
      key={show.mt20id}
      className="border overflow-hidden rounded p-4 mb-4 flex gap-3"
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
          <Badge variant={BADGE_VARIANT_BY_STATE[show.prfstate]}>
            {show.prfstate}
          </Badge>
        </div>
        <div title={show.prfnm} className="truncate text-text font-bold">
          {show.prfnm}
        </div>
        <p className="text-xs text-text-muted">{show.fcltynm}</p>
        <p className="text-xs text-muted-foreground">
          {show.prfpdfrom} - {show.prfpdto}
        </p>
      </div>
    </div>
  );
};
