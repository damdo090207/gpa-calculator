import { describe, expect, it } from "vitest";
import { formatGpa, summarize } from "./gpa";

describe("summarize (4.3 만점)", () => {
  it("빈 목록이면 평점은 null", () => {
    expect(summarize([])).toEqual({
      gpa: null, gpaCredits: 0, earnedCredits: 0, totalCredits: 0, pendingCredits: 0,
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

describe("formatGpa", () => {
  it("소수 둘째 자리까지 반올림", () => {
    expect(formatGpa(3.785)).toBe("3.79");
    expect(formatGpa(4.3)).toBe("4.30");
    expect(formatGpa(null)).toBe("-");
  });
});
