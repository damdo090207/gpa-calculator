"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Drawing } from "@/lib/types";

const EMPTY_DRAWING: Drawing = { version: 1, pages: [{ strokes: [] }] };

export async function createNote(courseId: string, kind: "markdown" | "drawing") {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .insert({
      course_id: courseId,
      kind,
      title: kind === "markdown" ? "새 노트" : "새 손필기",
      drawing: kind === "drawing" ? EMPTY_DRAWING : null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("노트를 만들지 못했어요.");
  redirect(`/courses/${courseId}/notes/${data.id}`);
}

export async function deleteNote(courseId: string, noteId: string) {
  const supabase = await createClient();
  await supabase.from("notes").delete().eq("id", noteId);
  revalidatePath(`/courses/${courseId}`);
  redirect(`/courses/${courseId}`);
}
