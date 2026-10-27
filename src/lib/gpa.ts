// 4.3 만점 기준 평점 계산
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

// 등급별 평점 × 10
const POINTS_X10: Record<LetterGrade, number> = {
  "A+": 43, A0: 40, "A-": 37,
  "B+": 33, B0: 30, "B-": 27,
  "C+": 23, C0: 20, "C-": 17,
  "D+": 13, D0: 10, "D-": 7,
  F: 0,
};

export type GradedCourse = {
  credits: number;
  is_pf: boolean;
  grade: string | null;
};

export type GpaSummary = {
  gpa: number | null;     // 평점 대상 과목이 없으면 null
  gpaCredits: number;     // 평점 계산에 들어간 학점 (등급 과목, F 포함)
  earnedCredits: number;  // 실제 취득 학점 (F·NP 제외, P 포함)
  totalCredits: number;   // 신청 학점 전체 (수강 중 포함)
  pendingCredits: number; // 아직 성적이 없는 학점
};

const toX10 = (credits: number) => Math.round(credits * 10);

export function gradePoint(grade: string): number | null {
  return grade in POINTS_X10 ? POINTS_X10[grade as LetterGrade] / 10 : null;
}

export function summarize(courses: GradedCourse[]): GpaSummary {
  let weightedX100 = 0; // Σ(학점×10 · 평점×10)
  let gpaX10 = 0;
  let earnedX10 = 0;
  let totalX10 = 0;
  let pendingX10 = 0;

  for (const c of courses) {
    const cr = toX10(Number(c.credits));
    totalX10 += cr;

    if (c.grade == null) {
      pendingX10 += cr;
    } else if (c.is_pf) {
      // P/F 과목은 평점에서 빠지고, P일 때만 취득 학점에 들어간다
      if (c.grade === "P") earnedX10 += cr;
    } else if (c.grade in POINTS_X10) {
      const p = POINTS_X10[c.grade as LetterGrade];
      weightedX100 += cr * p;
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
  };
}

// 화면 표시용: 소수 셋째 자리에서 반올림
// 3.785 * 100 이 378.49999… 로 나오는 문제 때문에 한 번 toFixed(8)로 잘라낸 뒤 반올림한다
export function formatGpa(gpa: number | null): string {
  if (gpa == null) return "-";
  return (Math.round(Number((gpa * 100).toFixed(8))) / 100).toFixed(2);
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
