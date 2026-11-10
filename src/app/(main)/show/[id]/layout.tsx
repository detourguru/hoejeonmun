import { permanentRedirect } from "next/navigation";
import { ReactNode } from "react";

import { createAdminClient } from "@/lib/supabase/admin";

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (id.startsWith("local-")) {
    const { data, error } = await createAdminClient()
      .from("show_redirects")
      .select("to_show_id")
      .eq("from_show_id", id)
      .maybeSingle();
    if (error) throw error;
    if (data) permanentRedirect(`/show/${encodeURIComponent(data.to_show_id)}`);
  }
  return children;
}
