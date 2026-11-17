// 평점 계산 (4.5 / 4.3 / 4.0 만점)
// 부동소수점 오차(예: 0.1 + 0.2)를 피하려고 학점·평점을 모두 10배 한 정수로 더한 뒤 마지막에 한 번만 나눈다.

export const LETTER_GRADES = [
  "A+", "A0", "A-",
  "B+", "B0", "B-",
  "C+", "C0", "C-",
  "D+", "D0", "D-",
  "F",
] as const;
export const PF_GRADES = ["P", "NP"] as const;

export type LetterGrade = (typeof LETTER_GRADES)[number];
export type PfGrade = (typeof PF_GRADES)[number];

export const SCALES = ["4.5", "4.3", "4.0"] as const;
export type Scale = (typeof SCALES)[number];
export const DEFAULT_SCALE: Scale = "4.3";

export function isScale(v: unknown): v is Scale {
  return SCALES.includes(v as Scale);
}

// 체계별 등급 평점 × 10
// 4.5 체계에는 보통 마이너스 등급이 없어서 선택지에서 뺀다.
// 다른 체계에서 넣어 둔 마이너스 등급은 같은 글자의 0 등급(A- → A0)으로 계산한다.
const POINTS_X10: Record<Scale, Record<LetterGrade, number>> = {
  "4.5": {
    "A+": 45, A0: 40, "A-": 40,
    "B+": 35, B0: 30, "B-": 30,
    "C+": 25, C0: 20, "C-": 20,
    "D+": 15, D0: 10, "D-": 10,
    F: 0,
  },
  "4.3": {
    "A+": 43, A0: 40, "A-": 37,
    "B+": 33, B0: 30, "B-": 27,
    "C+": 23, C0: 20, "C-": 17,
    "D+": 13, D0: 10, "D-": 7,
    F: 0,
  },
  // 4.0 체계: 4.3 체계에서 A+만 4.0으로 맞춘 형태
  "4.0": {
    "A+": 40, A0: 40, "A-": 37,
    "B+": 33, B0: 30, "B-": 27,
    "C+": 23, C0: 20, "C-": 17,
    "D+": 13, D0: 10, "D-": 7,
    F: 0,
  },
};

const NO_MINUS: readonly string[] = ["A-", "B-", "C-", "D-"];

// 과목 입력에서 고를 수 있는 등급
export function gradesFor(scale: Scale): readonly LetterGrade[] {
  return scale === "4.5" ? LETTER_GRADES.filter((g) => !NO_MINUS.includes(g)) : LETTER_GRADES;
}

// 이 체계에 없는 등급인지 (4.5 체계의 마이너스 등급)
export function isForeignGrade(grade: string | null, scale: Scale): boolean {
  return grade != null && scale === "4.5" && NO_MINUS.includes(grade);
}

export function maxPoint(scale: Scale): number {
  return POINTS_X10[scale]["A+"] / 10;
}

export function gradePoint(grade: string, scale: Scale = DEFAULT_SCALE): number | null {
  return grade in POINTS_X10[scale] ? POINTS_X10[scale][grade as LetterGrade] / 10 : null;
}

export type GradedCourse = {
  credits: number;
  is_pf: boolean;
  grade: string | null;
};

export type GpaSummary = {
  gpa: number | null;        // 평점 대상 과목이 없으면 null
  gpaCredits: number;        // 평점 계산에 들어간 학점 (등급 과목, F 포함)
  earnedCredits: number;     // 실제 취득 학점 (F·NP 제외, P 포함)
  totalCredits: number;      // 신청 학점 전체 (수강 중 포함)
  pendingCredits: number;    // 아직 성적이 없는 학점
  pendingGpaCredits: number; // 그중 평점에 들어갈 학점 (P/F 과목 제외)
};

const toX10 = (credits: number) => Math.round(credits * 10);

export function summarize(courses: GradedCourse[], scale: Scale = DEFAULT_SCALE): GpaSummary {
  const points = POINTS_X10[scale];
  let weightedX100 = 0; // Σ(학점×10 · 평점×10)
  let gpaX10 = 0;
  let earnedX10 = 0;
  let totalX10 = 0;
  let pendingX10 = 0;
  let pendingGpaX10 = 0;

  for (const c of courses) {
    const cr = toX10(Number(c.credits));
    totalX10 += cr;

    if (c.grade == null) {
      pendingX10 += cr;
      if (!c.is_pf) pendingGpaX10 += cr;
    } else if (c.is_pf) {
      // P/F 과목은 평점에서 빠지고, P일 때만 취득 학점에 들어간다
      if (c.grade === "P") earnedX10 += cr;
    } else if (c.grade in points) {
      weightedX100 += cr * points[c.grade as LetterGrade];
      gpaX10 += cr;
      if (c.grade !== "F") earnedX10 += cr;
    }
  }

  return {
    gpa: gpaX10 === 0 ? null : weightedX100 / gpaX10 / 10,
    gpaCredits: gpaX10 / 10,
    earnedCredits: earnedX10 / 10,
    totalCredits: totalX10 / 10,
    pendingCredits: pendingX10 / 10,
    pendingGpaCredits: pendingGpaX10 / 10,
  };
}

// 화면 표시용: 소수 셋째 자리에서 반올림
// 3.785 * 100 이 378.49999… 로 나오는 문제 때문에 한 번 toFixed(8)로 잘라낸 뒤 반올림한다
export function formatGpa(gpa: number | null): string {
  if (gpa == null) return "-";
  return (Math.round(Number((gpa * 100).toFixed(8))) / 100).toFixed(2);
}

export type TargetPlan =
  | { status: "no-credits" }                                    // 남은 학점이 0이라 계산할 수 없음
  | { status: "done"; remainingCredits: number }                // 남은 과목을 모두 F 받아도 목표 이상
  | { status: "ok"; remainingCredits: number; required: number; grade: LetterGrade }
  | { status: "impossible"; remainingCredits: number; best: number }; // 남은 과목 전부 만점이어도 부족

// 목표 평점을 이루려면 남은 학점에서 평균 몇 점이 필요한지 거꾸로 계산한다.
// 남은 학점 = 수강 중인 등급 과목 + (남은 학기 수 × 학기당 학점). 남은 과목은 모두 등급 과목으로 가정한다.
//   필요 평균 = (목표 × (지금까지 평점 학점 + 남은 학점) − 지금까지 받은 평점 합) ÷ 남은 학점
export function planTarget(
  summary: GpaSummary,
  scale: Scale,
  target: number,
  remainingSemesters: number,
  creditsPerSemester: number,
): TargetPlan {
  const remainingCredits = summary.pendingGpaCredits + remainingSemesters * creditsPerSemester;
  if (!(remainingCredits > 0)) return { status: "no-credits" };

  const earnedPoints = (summary.gpa ?? 0) * summary.gpaCredits;
  const allCredits = summary.gpaCredits + remainingCredits;
  const raw = (target * allCredits - earnedPoints) / remainingCredits;
  // "이상"을 보여 주므로 0.01 단위로 올림 (계산 오차로 4.0000001 같은 값이 4.01이 되지 않게 보정)
  const required = Math.ceil(Number((raw * 100).toFixed(6))) / 100;

  if (required <= 0) return { status: "done", remainingCredits };
  if (required > maxPoint(scale)) {
    const best = (earnedPoints + maxPoint(scale) * remainingCredits) / allCredits;
    return { status: "impossible", remainingCredits, best };
  }
  return { status: "ok", remainingCredits, required, grade: gradeAtLeast(required, scale) };
}

// 평점이 value 이상인 가장 낮은 등급 (예: 3.4 → 4.3 체계에서 A-)
function gradeAtLeast(value: number, scale: Scale): LetterGrade {
  const candidates = [...gradesFor(scale)].reverse(); // 낮은 등급부터
  return candidates.find((g) => POINTS_X10[scale][g] / 10 >= value) ?? "A+";
}

export const TERMS = [
  { value: "1", label: "1학기" },
  { value: "S", label: "여름학기" },
  { value: "2", label: "2학기" },
  { value: "W", label: "겨울학기" },
] as const;

export function termLabel(term: string): string {
  return TERMS.find((t) => t.value === term)?.label ?? term;
}

// 학기 정렬 순서: 연도 → 1학기 → 여름 → 2학기 → 겨울
export function termOrder(term: string): number {
  return TERMS.findIndex((t) => t.value === term);
}
