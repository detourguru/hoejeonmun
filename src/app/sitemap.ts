import { SITE_URL } from "@/lib/site";
import { getShows } from "@/service/show";

import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const shows = await getShows();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/show`,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/show/all`,
      changeFrequency: "hourly",
      priority: 0.8,
    },
  ];

  const showRoutes: MetadataRoute.Sitemap = shows.flatMap((show) => [
    {
      url: `${SITE_URL}/show/${show.mt20id}`,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/show/${show.mt20id}/castings`,
      changeFrequency: "daily",
      priority: 0.6,
    },
  ]);

  return [...staticRoutes, ...showRoutes];
}
