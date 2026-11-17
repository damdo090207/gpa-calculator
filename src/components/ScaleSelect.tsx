"use client";

import { useState, useTransition } from "react";
import { saveSettings } from "@/app/actions";
import { SCALES, type Scale } from "@/lib/gpa";

// 학점 체계(만점) 선택. 바꾸면 계정에 저장되고 모든 평점이 다시 계산된다.
export default function ScaleSelect({ scale }: { scale: Scale }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      학점 체계
      <select
        className="input w-28"
        value={scale}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            const r = await saveSettings({ scale: e.target.value as Scale });
            setError(r.error ?? null);
          })
        }
      >
        {SCALES.map((s) => (
          <option key={s} value={s}>{s} 만점</option>
        ))}
      </select>
      {error && <span className="text-danger">{error}</span>}
    </label>
  );
}
