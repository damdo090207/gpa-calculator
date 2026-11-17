"use client";

import { useRef, useState } from "react";
import { saveSettings } from "@/app/actions";
import { formatGpa, maxPoint, planTarget, type GpaSummary, type Scale } from "@/lib/gpa";
import type { Settings } from "@/lib/settings";

// 목표 평점을 넣으면 남은 학기에 평균 몇 점이 필요한지 바로 계산해 보여 준다.
// 입력값은 잠시 뒤 계정에 저장돼서 다음에는 목표만 바꿔도 된다.
export default function TargetCalculator({
  summary,
  scale,
  settings,
  defaultCredits,
}: {
  summary: GpaSummary;
  scale: Scale;
  settings: Settings;
  defaultCredits: number; // 지난 학기 평균 학점 (학기당 학점 기본값)
}) {
  const [target, setTarget] = useState(settings.target != null ? String(settings.target) : "");
  const [semesters, setSemesters] = useState(String(settings.remainingSemesters ?? 0));
  const [perSem, setPerSem] = useState(String(settings.creditsPerSemester ?? defaultCredits));
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingPatch = useRef<Partial<Settings>>({});

  const t = Number(target);
  const n = Number(semesters);
  const c = Number(perSem);
  const max = maxPoint(scale);
  const targetOk = target !== "" && t >= 0 && t <= max;
  const semOk = Number.isInteger(n) && n >= 0 && n <= 20;
  const perOk = c >= 0.5 && c <= 30;

  // 입력을 멈추고 0.8초 뒤 저장 (올바른 값만). 여러 칸을 연달아 바꿔도 함께 저장되도록 모아 둔다.
  const schedule = (patch: Partial<Settings>) => {
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const toSave = pendingPatch.current;
      pendingPatch.current = {};
      const r = await saveSettings(toSave);
      setSaveError(r.error ?? null);
    }, 800);
  };

  const plan = targetOk && semOk && perOk ? planTarget(summary, scale, t, n, c) : null;

  return (
    <section className="card mt-4 p-5">
      <h2 className="font-semibold">목표 평점 계산기</h2>
      <p className="mt-1 text-sm text-muted">목표 평점을 넣으면 남은 학기에 평균 몇 점이 필요한지 바로 알려 드려요.</p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Field label={`목표 평점 (최대 ${scale})`}>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            step={0.01}
            min={0}
            max={max}
            placeholder="예: 3.9"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              const v = Number(e.target.value);
              if (e.target.value === "") schedule({ target: null });
              else if (v >= 0 && v <= max) schedule({ target: v });
            }}
          />
        </Field>
        <Field label="남은 학기 수">
          <input
            className="input"
            type="number"
            inputMode="numeric"
            step={1}
            min={0}
            max={20}
            value={semesters}
            onChange={(e) => {
              setSemesters(e.target.value);
              const v = Number(e.target.value);
              if (Number.isInteger(v) && v >= 0 && v <= 20) schedule({ remainingSemesters: v });
            }}
          />
        </Field>
        <Field label="학기당 학점">
          <input
            className="input"
            type="number"
            inputMode="decimal"
            step={0.5}
            min={0.5}
            max={30}
            value={perSem}
            onChange={(e) => {
              setPerSem(e.target.value);
              const v = Number(e.target.value);
              if (v >= 0.5 && v <= 30) schedule({ creditsPerSemester: v });
            }}
          />
        </Field>
      </div>

      <div className="mt-4 rounded-lg bg-bg px-4 py-3 text-sm" aria-live="polite">
        {target === "" ? (
          <p className="text-muted">목표 평점을 입력해 보세요.</p>
        ) : !targetOk ? (
          <p className="text-danger">목표 평점은 0~{scale} 사이로 입력해 주세요.</p>
        ) : !semOk || !perOk ? (
          <p className="text-danger">남은 학기 수는 0~20, 학기당 학점은 0.5~30으로 입력해 주세요.</p>
        ) : plan?.status === "no-credits" ? (
          <p className="text-muted">남은 학점이 없어요. 남은 학기 수를 입력하거나 수강 중인 과목을 추가해 주세요.</p>
        ) : plan?.status === "done" ? (
          <p>
            <b className="text-ok">이미 목표를 넘었어요.</b> 남은 과목 성적과 상관없이 목표 {formatGpa(t)} 이상이에요.
          </p>
        ) : plan?.status === "impossible" ? (
          <p>
            <b className="text-danger">남은 과목을 모두 A+ 받아도 최대 {formatGpa(plan.best)}까지예요.</b> 목표를 조금 낮추거나 남은 학기를 늘려 보세요.
          </p>
        ) : plan?.status === "ok" ? (
          <>
            <p className="text-base">
              남은 학기 동안 평균 <b className="text-xl tabular-nums text-accent">{plan.required.toFixed(2)}</b> 이상이 필요해요.
            </p>
            <p className="mt-1 text-muted">과목마다 {plan.grade} 이상이면 충분해요.</p>
          </>
        ) : null}
        {plan && plan.status !== "no-credits" && (
          <p className="mt-2 text-xs text-muted">
            남은 학점 {plan.remainingCredits} = 수강 중 {summary.pendingGpaCredits}
            {" "}+ 앞으로 {n}학기 × {c}학점
            {" "}· P/F 과목은 평점에서 빠지므로 남은 학점에 넣지 않아요.
          </p>
        )}
        {saveError && <p className="mt-2 text-xs text-danger">{saveError}</p>}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      {children}
    </label>
  );
}
