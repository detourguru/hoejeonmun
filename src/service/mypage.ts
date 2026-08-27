import { createClient } from "@/lib/supabase/server";
import { getUploadImages } from "@/service/casting";
import { getShow } from "@/service/show";

export type MyUpload = {
  id: number;
  showId: string;
  showName: string;
  createdAt: string;
  images: string[];
};

export async function getMyUploads(userId: string): Promise<MyUpload[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("uploads")
    .select("id, show_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const uploads = data as {
    id: number;
    show_id: string;
    created_at: string;
  }[];

  const showIds = [...new Set(uploads.map(({ show_id }) => show_id))];
  const shows = await Promise.all(showIds.map((id) => getShow(id)));
  const showNameById = new Map(
    showIds.map((id, index) => [id, shows[index]?.prfnm ?? "알 수 없는 공연"]),
  );

  return Promise.all(
    uploads.map(async (upload) => ({
      id: upload.id,
      showId: upload.show_id,
      showName: showNameById.get(upload.show_id) ?? "알 수 없는 공연",
      createdAt: upload.created_at,
      images: await getUploadImages(upload.id),
    })),
  );
}
