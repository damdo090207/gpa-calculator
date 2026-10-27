import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Note } from "@/lib/types";
import MarkdownEditor from "@/components/MarkdownEditor";
import DrawingEditor from "@/components/DrawingEditor";
import NoteHeader from "@/components/NoteHeader";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string; noteId: string }>;
}) {
  const { id, noteId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select("id, course_id, kind, title, content, drawing, updated_at, courses(name)")
    .eq("id", noteId)
    .eq("course_id", id)
    .maybeSingle();
  if (!data) notFound();

  const note = data as unknown as Note & { courses: { name: string } | null };

  return (
    <main className={`mx-auto px-4 py-4 ${note.kind === "drawing" ? "max-w-5xl" : "max-w-6xl"}`}>
      <NoteHeader note={note} courseName={note.courses?.name ?? ""} />
      {note.kind === "markdown" ? <MarkdownEditor note={note} /> : <DrawingEditor note={note} />}
    </main>
  );
}
