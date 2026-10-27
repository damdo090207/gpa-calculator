"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteCourse, deleteSemester, saveCourse, type CourseInput } from "@/app/actions";
import { LETTER_GRADES, PF_GRADES, formatGpa, summarize, termLabel } from "@/lib/gpa";
import type { Course, Semester } from "@/lib/types";

export default function SemesterCard({ semester }: { semester: Semester }) {
  const s = summarize(semester.courses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  const removeSemester = () => {
    const msg = semester.courses.length
      ? `${semester.year}년 ${termLabel(semester.term)}과 과목 ${semester.courses.length}개, 그 안의 필기·파일까지 모두 지울까요?`
      : `${semester.year}년 ${termLabel(semester.term)}을 지울까요?`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      const r = await deleteSemester(semester.id);
      if (r.error) alert(r.error);
    });
  };

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-semibold">
          {semester.year}년 {termLabel(semester.term)}
        </h2>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>
            평점 <b className="tabular-nums text-fg">{formatGpa(s.gpa)}</b>
          </span>
          <span className="tabular-nums">{s.totalCredits}학점</span>
          <button className="btn-ghost" onClick={removeSemester} disabled={pending}>삭제</button>
        </div>
      </header>

      <ul className="divide-y divide-line">
        {semester.courses.map((c) =>
          editingId === c.id ? (
            <li key={c.id} className="px-4 py-3">
              <CourseForm
                semesterId={semester.id}
                course={c}
                onDone={() => setEditingId(null)}
              />
            </li>
          ) : (
            <CourseRow key={c.id} course={c} onEdit={() => setEditingId(c.id)} />
          ),
        )}
      </ul>

      <div className="border-t border-line px-4 py-3">
        {adding ? (
          <CourseForm semesterId={semester.id} onDone={() => setAdding(false)} keepOpen />
        ) : (
          <button className="btn-ghost" onClick={() => setAdding(true)}>+ 과목 추가</button>
        )}
      </div>
    </section>
  );
}

function CourseRow({ course, onEdit }: { course: Course; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const remove = () => {
    if (!confirm(`'${course.name}' 과목과 그 안의 필기·파일을 모두 지울까요?`)) return;
    startTransition(async () => {
      const r = await deleteCourse(course.id);
      if (r.error) alert(r.error);
    });
  };

  return (
    <li className={`flex items-center gap-3 px-4 py-2.5 ${pending ? "opacity-50" : ""}`}>
      <Link href={`/courses/${course.id}`} className="min-w-0 flex-1 truncate hover:underline">
        {course.name}
      </Link>
      {course.is_pf && <span className="rounded bg-bg px-1.5 py-0.5 text-xs text-muted">P/F</span>}
      <span className="w-12 text-right text-sm tabular-nums text-muted">{Number(course.credits)}학점</span>
      <span className={`w-10 text-right font-semibold tabular-nums ${gradeColor(course.grade)}`}>
        {course.grade ?? "-"}
      </span>
      <div className="flex">
        <button className="btn-ghost" onClick={onEdit} aria-label="수정">수정</button>
        <button className="btn-ghost" onClick={remove} disabled={pending} aria-label="삭제">✕</button>
      </div>
    </li>
  );
}

function gradeColor(grade: string | null) {
  if (grade === "F" || grade === "NP") return "text-danger";
  if (grade == null) return "text-muted";
  return "";
}

function CourseForm({
  semesterId,
  course,
  onDone,
  keepOpen,
}: {
  semesterId: string;
  course?: Course;
  onDone: () => void;
  keepOpen?: boolean; // 새 과목 추가 시 저장 후 폼을 비우고 계속 입력
}) {
  const [name, setName] = useState(course?.name ?? "");
  const [credits, setCredits] = useState(String(course ? Number(course.credits) : 3));
  const [isPf, setIsPf] = useState(course?.is_pf ?? false);
  const [grade, setGrade] = useState(course?.grade ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const grades = isPf ? PF_GRADES : LETTER_GRADES;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: CourseInput = {
      id: course?.id,
      semester_id: semesterId,
      name,
      credits: Number(credits),
      is_pf: isPf,
      grade: grade || null,
    };
    startTransition(async () => {
      const r = await saveCourse(input);
      if (r.error) return setError(r.error);
      setError(null);
      if (keepOpen) {
        setName("");
        setGrade("");
      } else {
        onDone();
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="과목명"
          className="input min-w-40 flex-1"
          autoFocus
          aria-label="과목명"
        />
        <input
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          type="number"
          step={0.5}
          min={0.5}
          max={30}
          className="input w-20"
          aria-label="학점"
        />
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={isPf}
            onChange={(e) => {
              setIsPf(e.target.checked);
              setGrade(""); // 종류가 바뀌면 기존 성적은 맞지 않으므로 초기화
            }}
          />
          P/F
        </label>
        <select value={grade} onChange={(e) => setGrade(e.target.value)} className="input w-28" aria-label="성적">
          <option value="">성적 미정</option>
          {grades.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn-primary" disabled={pending}>{course ? "저장" : "추가"}</button>
        <button type="button" className="btn" onClick={onDone}>{keepOpen ? "닫기" : "취소"}</button>
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    </form>
  );
}
