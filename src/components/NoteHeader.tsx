"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteNote } from "@/app/courses/[id]/actions";
import type { Note } from "@/lib/types";

// 제목 수정은 각 편집기가 자동 저장과 묶어서 처리하므로, 여기는 이동·삭제만 담당
export default function NoteHeader({ note, courseName }: { note: Note; courseName: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <Link href={`/courses/${note.course_id}`} className="btn-ghost -ml-2 truncate">
        ← {courseName}
      </Link>
      <button
        className="btn-ghost text-danger"
        disabled={pending}
        onClick={() => {
          if (confirm("이 노트를 삭제할까요?")) startTransition(() => deleteNote(note.course_id, note.id));
        }}
      >
        노트 삭제
      </button>
    </div>
  );
}
