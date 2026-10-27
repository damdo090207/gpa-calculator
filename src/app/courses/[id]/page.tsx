import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { termLabel } from "@/lib/gpa";
import { createClient } from "@/lib/supabase/server";
import type { CourseFile, Note } from "@/lib/types";
import FilesSection from "@/components/FilesSection";
import { createNote } from "./actions";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: course }, { data: notes }, { data: files }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, name, credits, is_pf, grade, semesters(year, term)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("notes")
      .select("id, kind, title, updated_at")
      .eq("course_id", id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("course_files")
      .select("*")
      .eq("course_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!course) notFound();

  const sem = course.semesters as unknown as { year: number; term: string } | null;
  const newMarkdown = createNote.bind(null, id, "markdown");
  const newDrawing = createNote.bind(null, id, "drawing");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Link href="/" className="btn-ghost -ml-2">← 학기 목록</Link>
      <header className="mt-2">
        <p className="text-sm text-muted">
          {sem && `${sem.year}년 ${termLabel(sem.term)} · `}
          {Number(course.credits)}학점{course.is_pf && " · P/F"} · 성적 {course.grade ?? "미정"}
        </p>
        <h1 className="mt-1 text-2xl font-bold">{course.name}</h1>
      </header>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">노트</h2>
          <div className="flex gap-2">
            <form action={newMarkdown}><button className="btn">+ 마크다운</button></form>
            <form action={newDrawing}><button className="btn">+ 손필기</button></form>
          </div>
        </div>
        <ul className="card mt-3 divide-y divide-line">
          {((notes ?? []) as Pick<Note, "id" | "kind" | "title" | "updated_at">[]).map((n) => (
            <li key={n.id}>
              <Link
                href={`/courses/${id}/notes/${n.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-bg"
              >
                <span className="w-14 shrink-0 text-xs text-muted">
                  {n.kind === "markdown" ? "마크다운" : "손필기"}
                </span>
                <span className="min-w-0 flex-1 truncate">{n.title}</span>
                <time className="shrink-0 text-xs text-muted">
                  {new Date(n.updated_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                </time>
              </Link>
            </li>
          ))}
          {!notes?.length && <li className="px-4 py-6 text-center text-sm text-muted">아직 노트가 없어요.</li>}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">파일</h2>
        <FilesSection courseId={id} userId={user.id} initialFiles={(files ?? []) as CourseFile[]} />
      </section>
    </main>
  );
}
