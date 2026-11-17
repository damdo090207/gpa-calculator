import { DEFAULT_SCALE, isScale, type Scale } from "./gpa";

// 사용자별 설정. 별도 테이블 없이 Supabase 계정의 user_metadata 에 저장한다.
export type Settings = {
  scale: Scale;
  target: number | null;              // 목표 평점
  remainingSemesters: number | null;  // 남은 학기 수
  creditsPerSemester: number | null;  // 앞으로 학기당 들을 학점
};

const num = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;

export function readSettings(meta: Record<string, unknown> | undefined): Settings {
  const m = meta ?? {};
  const scale = isScale(m.gpa_scale) ? m.gpa_scale : DEFAULT_SCALE;
  return {
    scale,
    target: num(m.target_gpa, 0, 4.5),
    remainingSemesters: num(m.remaining_semesters, 0, 20),
    creditsPerSemester: num(m.credits_per_semester, 0.5, 30),
  };
}

export function toMetadata(s: Partial<Settings>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (s.scale !== undefined) out.gpa_scale = s.scale;
  if (s.target !== undefined) out.target_gpa = s.target;
  if (s.remainingSemesters !== undefined) out.remaining_semesters = s.remainingSemesters;
  if (s.creditsPerSemester !== undefined) out.credits_per_semester = s.creditsPerSemester;
  return out;
}
