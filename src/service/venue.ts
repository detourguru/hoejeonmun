import { fetchKopis, fetchKopisAll, toArray } from "@/lib/kopis";
import { createAdminClient } from "@/lib/supabase/admin";

const VENUE_LIST_MAX_PAGES = 50;

type VenueListItem = { mt10id: string };

type VenueHall = {
  mt13id: string;
  prfplcnm: string;
  seatscale?: string;
};

type VenueDetail = {
  mt10id: string;
  fcltynm: string;
  mt13s?: { mt13?: VenueHall | VenueHall[] };
};

function parseSeatScale(raw?: string): number | null {
  if (!raw) return null;

  const digits = raw.replace(/[^0-9]/g, "");

  return digits ? Number(digits) : null;
}

export type VenueSyncOptions = {
  afterdate?: string;
  offset?: number;
  limit?: number;
};

export type VenueSyncResult = {
  totalFacilities: number;
  processed: number;
  syncedHalls: number;
  failed: { mt10id: string; error: string }[];
};

export async function syncVenuesFromKopis(
  options: VenueSyncOptions = {},
): Promise<VenueSyncResult> {
  const { afterdate, offset = 0, limit = Infinity } = options;

  const params = new URLSearchParams();
  if (afterdate) params.set("afterdate", afterdate);

  const facilities = await fetchKopisAll<VenueListItem>("/prfplc", params, {
    maxPages: VENUE_LIST_MAX_PAGES,
    revalidate: false,
  });

  const targets = facilities
    .filter((facility) => facility?.mt10id)
    .slice(offset, offset + limit);

  const admin = createAdminClient();
  const failed: VenueSyncResult["failed"] = [];
  let syncedHalls = 0;

  await Promise.all(
    targets.map(async (facility) => {
      try {
        const [detail] = await fetchKopis<VenueDetail>(
          `/prfplc/${encodeURIComponent(facility.mt10id)}`,
          new URLSearchParams(),
          { revalidate: false },
        );

        if (!detail) return;

        const halls = toArray(detail.mt13s?.mt13).filter(
          (hall) => hall?.mt13id,
        );

        if (halls.length === 0) return;

        const rows = halls.map((hall) => ({
          mt13id: hall.mt13id,
          mt10id: detail.mt10id,
          facility_name: detail.fcltynm,
          hall_name: hall.prfplcnm,
          seat_scale: parseSeatScale(hall.seatscale),
          synced_at: new Date().toISOString(),
        }));

        const { error } = await admin
          .from("venue_halls")
          .upsert(rows, { onConflict: "mt13id" });

        if (error) throw error;

        syncedHalls += rows.length;
      } catch (error) {
        failed.push({
          mt10id: facility.mt10id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );

  return {
    totalFacilities: facilities.length,
    processed: targets.length,
    syncedHalls,
    failed,
  };
}

export async function getVenueSeatScales(
  mt13ids: string[],
): Promise<Map<string, number | null>> {
  const ids = [...new Set(mt13ids.filter(Boolean))];

  if (ids.length === 0) return new Map();

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("venue_halls")
    .select("mt13id, seat_scale")
    .in("mt13id", ids);

  if (error) throw error;

  const rows = data as { mt13id: string; seat_scale: number | null }[];

  return new Map(rows.map((row) => [row.mt13id, row.seat_scale]));
}
