"use client";

import { useActionState } from "react";
import { addSemester, type ActionResult } from "@/app/actions";
import { TERMS } from "@/lib/gpa";

export default function AddSemesterForm() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(addSemester, {});
  const now = new Date();
  // 3~8월이면 1학기, 그 외엔 2학기를 기본값으로
  const defaultTerm = now.getMonth() >= 2 && now.getMonth() <= 7 ? "1" : "2";

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input
        name="year"
        type="number"
        defaultValue={now.getFullYear()}
        min={1900}
        max={2200}
        className="input w-24"
        aria-label="연도"
      />
      <select name="term" defaultValue={defaultTerm} className="input w-28" aria-label="학기">
        {TERMS.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <button className="btn-primary" disabled={pending}>+ 학기 추가</button>
      {state.error && <span className="text-sm text-danger">{state.error}</span>}
    </form>
  );
}
