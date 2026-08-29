"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ToggleSlotResult =
  { ok: true; bookmarked: boolean } | { ok: false; message: string };

export async function toggleMySlot(
  slotId: number,
  bookmarked: boolean,
): Promise<ToggleSlotResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return { ok: false, message: "로그인이 필요해요." };

  const { error } = bookmarked
    ? await supabase
        .from("my_slots")
        .delete()
        .eq("slot_id", slotId)
        .eq("user_id", userId)
    : await supabase
        .from("my_slots")
        .insert({ slot_id: slotId, user_id: userId });

  if (error) {
    console.error(error);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/mypage/shows");

  return { ok: true, bookmarked: !bookmarked };
}

export type ToggleEventGroupResult =
  { ok: true; bookmarked: boolean } | { ok: false; message: string };

export async function toggleMyEventGroup(
  groupId: number,
  bookmarked: boolean,
  date: string,
): Promise<ToggleEventGroupResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return { ok: false, message: "로그인이 필요해요." };

  const { error } = bookmarked
    ? await supabase
        .from("my_event_groups")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", userId)
    : await supabase
        .from("my_event_groups")
        .insert({ group_id: groupId, user_id: userId, date });

  if (error) {
    console.error(error);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/mypage/shows");

  return { ok: true, bookmarked: !bookmarked };
}
