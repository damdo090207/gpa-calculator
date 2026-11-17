import { describe, expect, it } from "vitest";
import { formatGpa, gpaTrend, gradesFor, isForeignGrade, planTarget, summarize } from "./gpa";

describe("summarize (4.3 만점)", () => {
  it("빈 목록이면 평점은 null", () => {
    expect(summarize([])).toEqual({
      gpa: null, gpaCredits: 0, earnedCredits: 0, totalCredits: 0, pendingCredits: 0, pendingGpaCredits: 0,
    });
  });

  it("학점 가중 평균을 계산한다", () => {
    // (3×4.3 + 2×3.0) / 5 = 18.9 / 5 = 3.78
    const s = summarize([
      { credits: 3, is_pf: false, grade: "A+" },
      { credits: 2, is_pf: false, grade: "B0" },
    ]);
    expect(s.gpa).toBeCloseTo(3.78, 10);
    expect(s.gpaCredits).toBe(5);
    expect(s.earnedCredits).toBe(5);
  });

  it("F는 평점 분모에는 들어가고 취득 학점에서는 빠진다", () => {
    // (3×4.0 + 3×0) / 6 = 2.0
    const s = summarize([
      { credits: 3, is_pf: false, grade: "A0" },
      { credits: 3, is_pf: false, grade: "F" },
    ]);
    expect(s.gpa).toBe(2);
    expect(s.gpaCredits).toBe(6);
    expect(s.earnedCredits).toBe(3);
  });

  it("P/F 과목은 평점에서 제외, P만 취득 학점에 포함", () => {
    const s = summarize([
      { credits: 3, is_pf: false, grade: "B+" },
      { credits: 1, is_pf: true, grade: "P" },
      { credits: 2, is_pf: true, grade: "NP" },
    ]);
    expect(s.gpa).toBeCloseTo(3.3, 10);
    expect(s.gpaCredits).toBe(3);
    expect(s.earnedCredits).toBe(4);
    expect(s.totalCredits).toBe(6);
  });

  it("성적 미입력 과목은 대기 학점으로만 잡힌다", () => {
    const s = summarize([
      { credits: 3, is_pf: false, grade: null },
      { credits: 1, is_pf: true, grade: null },
    ]);
    expect(s.gpa).toBeNull();
    expect(s.pendingCredits).toBe(4);
    expect(s.pendingGpaCredits).toBe(3); // P/F 과목은 평점에 안 들어감
    expect(s.totalCredits).toBe(4);
  });

  it("0.5학점 단위와 문자열 학점(numeric)도 오차 없이 처리", () => {
    // Supabase는 numeric 컬럼을 문자열로 돌려줄 수 있음
    const s = summarize([
      { credits: "0.5" as unknown as number, is_pf: false, grade: "A-" },
      { credits: 0.5, is_pf: false, grade: "C+" },
    ]);
    // (0.5×3.7 + 0.5×2.3) / 1 = 3.0
    expect(s.gpa).toBe(3);
    expect(s.gpaCredits).toBe(1);
  });
});

describe("학점 체계 (4.5 / 4.0)", () => {
  const courses = [
    { credits: 3, is_pf: false, grade: "A+" },
    { credits: 2, is_pf: false, grade: "B+" },
  ];

  it("4.5 만점: A+ 4.5, B+ 3.5", () => {
    // (3×4.5 + 2×3.5) / 5 = 20.5 / 5 = 4.1
    expect(summarize(courses, "4.5").gpa).toBeCloseTo(4.1, 10);
  });

  it("4.0 만점: A+도 4.0", () => {
    // (3×4.0 + 2×3.3) / 5 = 18.6 / 5 = 3.72
    expect(summarize(courses, "4.0").gpa).toBeCloseTo(3.72, 10);
  });

  it("4.5 체계에는 마이너스 등급이 없고, 남아 있으면 0 등급으로 계산", () => {
    expect(gradesFor("4.5")).not.toContain("A-");
    expect(gradesFor("4.3")).toContain("A-");
    expect(isForeignGrade("B-", "4.5")).toBe(true);
    expect(isForeignGrade("B-", "4.3")).toBe(false);
    expect(summarize([{ credits: 3, is_pf: false, grade: "B-" }], "4.5").gpa).toBe(3);
  });
});

describe("planTarget (목표 평점 역산)", () => {
  // 지금까지 5학점, 평점 3.78 (평점 합 18.9)
  const s = summarize([
    { credits: 3, is_pf: false, grade: "A+" },
    { credits: 2, is_pf: false, grade: "B0" },
  ]);

  it("남은 학점에서 필요한 평균을 계산한다", () => {
    // 목표 4.0, 남은 1학기 × 5학점: (4.0×10 − 18.9) / 5 = 4.22
    const p = planTarget(s, "4.3", 4.0, 1, 5);
    expect(p).toEqual({ status: "ok", remainingCredits: 5, required: 4.22, grade: "A+" });
  });

  it("필요 평균에 맞는 최소 등급을 알려 준다", () => {
    // 목표 3.5, 남은 1학기 × 5학점: (35 − 18.9) / 5 = 3.22 → B+(3.3) 이상
    const p = planTarget(s, "4.3", 3.5, 1, 5);
    expect(p).toMatchObject({ status: "ok", required: 3.22, grade: "B+" });
  });

  it("수강 중인 등급 과목도 남은 학점에 넣는다", () => {
    const withPending = summarize([
      { credits: 3, is_pf: false, grade: "A+" },
      { credits: 2, is_pf: false, grade: "B0" },
      { credits: 3, is_pf: false, grade: null },
      { credits: 1, is_pf: true, grade: null },
    ]);
    // 남은 학점 = 수강 중 3 + 1학기 × 2 = 5 (P/F 1학점 제외)
    expect(planTarget(withPending, "4.3", 4.0, 1, 2)).toMatchObject({ remainingCredits: 5, required: 4.22 });
  });

  it("만점을 받아도 부족하면 최대치를 알려 준다", () => {
    // 남은 5학점을 모두 4.3: (18.9 + 21.5) / 10 = 4.04
    const p = planTarget(s, "4.3", 4.2, 1, 5);
    expect(p.status).toBe("impossible");
    if (p.status === "impossible") expect(p.best).toBeCloseTo(4.04, 10);
  });

  it("이미 넘었으면 done, 남은 학점이 없으면 no-credits", () => {
    expect(planTarget(s, "4.3", 1.0, 1, 5).status).toBe("done");
    expect(planTarget(s, "4.3", 3.9, 0, 18).status).toBe("no-credits");
  });

  it("4.5 체계에서는 4.3을 넘는 평균도 가능", () => {
    const s45 = summarize([{ credits: 3, is_pf: false, grade: "A0" }], "4.5"); // 4.0
    // 목표 4.3, 남은 3학점: (4.3×6 − 12) / 3 = 4.6 → 불가능, 목표 4.2: (25.2−12)/3 = 4.4 → A+
    expect(planTarget(s45, "4.5", 4.3, 1, 3).status).toBe("impossible");
    expect(planTarget(s45, "4.5", 4.2, 1, 3)).toMatchObject({ status: "ok", required: 4.4, grade: "A+" });
  });
});

describe("gpaTrend (학기별 평점 변화)", () => {
  const A = (credits: number, grade: string | null, is_pf = false) => ({ credits, is_pf, grade });

  it("오래된 학기부터, 학기 평점과 그때까지의 누적 평점을 낸다", () => {
    const t = gpaTrend([
      { year: 2026, term: "2", courses: [A(2, "B0")] },
      { year: 2025, term: "2", courses: [A(3, "A+")] },
      { year: 2026, term: "1", courses: [A(3, "A0")] },
    ]);
    expect(t.map((p) => `${p.year}-${p.term}`)).toEqual(["2025-2", "2026-1", "2026-2"]);
    expect(t.map((p) => p.semesterGpa)).toEqual([4.3, 4, 3]);
    // 누적: 4.3 → (12.9+12)/6 = 4.15 → (24.9+6)/8 = 3.8625
    expect(t[1].cumulativeGpa).toBeCloseTo(4.15, 10);
    expect(t[2].cumulativeGpa).toBeCloseTo(3.8625, 10);
  });

  it("평점을 낼 수 없는 학기(성적 미정·P/F만)는 빼고, 누적에는 영향이 없다", () => {
    const t = gpaTrend([
      { year: 2026, term: "1", courses: [A(3, "A0")] },
      { year: 2026, term: "S", courses: [A(1, "P", true)] },
      { year: 2026, term: "2", courses: [A(3, null)] },
    ]);
    expect(t).toHaveLength(1);
    expect(t[0].cumulativeGpa).toBe(4);
  });

  it("학점 체계를 따른다", () => {
    expect(gpaTrend([{ year: 2026, term: "1", courses: [A(3, "A+")] }], "4.5")[0].semesterGpa).toBe(4.5);
  });
});

describe("formatGpa", () => {
  it("소수 둘째 자리까지 반올림", () => {
    expect(formatGpa(3.785)).toBe("3.79");
    expect(formatGpa(4.3)).toBe("4.30");
    expect(formatGpa(null)).toBe("-");
  });
});
