"use server";

import { revalidatePath } from "next/cache";
import { LETTER_GRADES, PF_GRADES, TERMS, isScale, maxPoint } from "@/lib/gpa";
import { readSettings, toMetadata, type Settings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

// 학점 체계·목표 평점 설정 저장 (user_metadata 에 합쳐서 저장)
export async function saveSettings(patch: Partial<Settings>): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요." };

  const next = { ...readSettings(user.user_metadata), ...patch };
  if (!isScale(next.scale)) return { error: "학점 체계를 다시 골라 주세요." };
  // readSettings 를 다시 거쳐서 범위를 벗어난 값은 저장하지 않는다
  const clean = readSettings(toMetadata(next));
  // 목표를 새로 넣을 때만 만점 이하인지 본다 (체계만 바꿀 때 예전 목표 때문에 막히지 않게)
  if (patch.target != null && (clean.target == null || patch.target > maxPoint(next.scale))) {
    return { error: `목표 평점은 0~${next.scale} 사이로 입력해 주세요.` };
  }

  const { error } = await supabase.auth.updateUser({ data: toMetadata(clean) });
  if (error) return { error: "설정을 저장하지 못했어요." };
  revalidatePath("/");
  return {};
}

export async function addSemester(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const year = Number(formData.get("year"));
  const term = String(formData.get("term"));
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return { error: "연도를 확인해 주세요." };
  if (!TERMS.some((t) => t.value === term)) return { error: "학기를 골라 주세요." };

  const supabase = await createClient();
  const { error } = await supabase.from("semesters").insert({ year, term });
  if (error) {
    // 23505 = unique 위반 (같은 연도·학기를 두 번 추가)
    return { error: error.code === "23505" ? "이미 있는 학기예요." : "학기를 추가하지 못했어요." };
  }
  revalidatePath("/");
  return {};
}

export async function deleteSemester(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  // 과목·노트·파일 메타데이터는 on delete cascade 로 함께 지워진다
  const paths = await filePathsOf(supabase, { semesterId: id });
  const { error } = await supabase.from("semesters").delete().eq("id", id);
  if (error) return { error: "학기를 삭제하지 못했어요." };
  if (paths.length) await supabase.storage.from("course-files").remove(paths);
  revalidatePath("/");
  return {};
}

export type CourseInput = {
  id?: string;
  semester_id: string;
  name: string;
  credits: number;
  is_pf: boolean;
  grade: string | null;
};

function validateCourse(c: CourseInput): string | null {
  if (!c.name.trim()) return "과목명을 입력해 주세요.";
  if (c.name.length > 100) return "과목명이 너무 길어요.";
  if (!(c.credits > 0 && c.credits <= 30) || Math.round(c.credits * 10) !== c.credits * 10) {
    return "학점은 0보다 크고 30 이하, 소수 첫째 자리까지예요.";
  }
  if (c.grade != null) {
    const allowed: readonly string[] = c.is_pf ? PF_GRADES : LETTER_GRADES;
    if (!allowed.includes(c.grade)) return "성적을 다시 골라 주세요.";
  }
  return null;
}

export async function saveCourse(input: CourseInput): Promise<ActionResult> {
  const err = validateCourse(input);
  if (err) return { error: err };

  const supabase = await createClient();
  const row = {
    semester_id: input.semester_id,
    name: input.name.trim(),
    credits: input.credits,
    is_pf: input.is_pf,
    grade: input.grade,
  };
  const { error } = input.id
    ? await supabase.from("courses").update(row).eq("id", input.id)
    : await supabase.from("courses").insert(row);
  if (error) return { error: "과목을 저장하지 못했어요." };

  revalidatePath("/");
  if (input.id) revalidatePath(`/courses/${input.id}`);
  return {};
}

export async function deleteCourse(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const paths = await filePathsOf(supabase, { courseId: id });
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) return { error: "과목을 삭제하지 못했어요." };
  if (paths.length) await supabase.storage.from("course-files").remove(paths);
  revalidatePath("/");
  return {};
}

// DB 행은 cascade 로 지워지지만 스토리지 객체는 남으므로, 지우기 전에 경로를 모아 둔다
async function filePathsOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  by: { courseId?: string; semesterId?: string },
): Promise<string[]> {
  let courseIds: string[] = [];
  if (by.courseId) courseIds = [by.courseId];
  if (by.semesterId) {
    const { data } = await supabase.from("courses").select("id").eq("semester_id", by.semesterId);
    courseIds = (data ?? []).map((c) => c.id);
  }
  if (!courseIds.length) return [];
  const { data } = await supabase.from("course_files").select("storage_path").in("course_id", courseIds);
  return (data ?? []).map((f) => f.storage_path);
}
