import { redirect } from "next/navigation";
import { formatGpa, summarize, termOrder } from "@/lib/gpa";
import { createClient } from "@/lib/supabase/server";
import type { Semester } from "@/lib/types";
import { signOut } from "./login/actions";
import AddSemesterForm from "@/components/AddSemesterForm";
import SemesterCard from "@/components/SemesterCard";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("semesters")
    .select("id, year, term, courses(id, semester_id, name, credits, is_pf, grade)")
    .order("created_at", { referencedTable: "courses" });

  // 최신 학기가 위로 오도록 정렬
  const semesters = ((data ?? []) as Semester[]).sort(
    (a, b) => b.year - a.year || termOrder(b.term) - termOrder(a.term),
  );
  const total = summarize(semesters.flatMap((s) => s.courses));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">학점 계산기</h1>
        <form action={signOut} className="flex items-center gap-2 text-sm text-muted">
          <span className="hidden truncate sm:inline">{user.email}</span>
          <button className="btn-ghost">로그아웃</button>
        </form>
      </header>

      <section className="card mt-5 grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Stat label="누적 평점" value={formatGpa(total.gpa)} sub="/ 4.3" big />
        <Stat label="취득 학점" value={String(total.earnedCredits)} />
        <Stat label="평점 반영 학점" value={String(total.gpaCredits)} />
        <Stat label="수강 중" value={String(total.pendingCredits)} />
      </section>

      {error && <p className="mt-4 text-sm text-danger">데이터를 불러오지 못했어요: {error.message}</p>}

      <div className="mt-6">
        <AddSemesterForm />
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {semesters.map((s) => (
          <SemesterCard key={s.id} semester={s} />
        ))}
        {semesters.length === 0 && !error && (
          <p className="py-10 text-center text-sm text-muted">학기를 추가하고 과목을 입력해 보세요.</p>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, sub, big }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 font-bold tabular-nums ${big ? "text-3xl text-accent" : "text-2xl"}`}>
        {value}
        {sub && <span className="ml-1 text-sm font-normal text-muted">{sub}</span>}
      </div>
    </div>
  );
}
