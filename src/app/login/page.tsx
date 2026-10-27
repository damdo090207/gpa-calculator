import SubmitButton from "@/components/SubmitButton";
import { sendMagicLink } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-bold">학점 계산기</h1>
        <p className="mt-1 text-sm text-muted">
          이메일로 로그인 링크를 보내드려요. 비밀번호는 필요 없어요.
        </p>
      </div>

      {sent ? (
        <p className="rounded-lg border border-line bg-card p-4 text-sm">
          메일함을 확인해 주세요. 받은 링크를 <b>이 브라우저에서</b> 열어야 로그인돼요.
        </p>
      ) : (
        <form action={sendMagicLink} className="flex flex-col gap-3">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="input"
          />
          <SubmitButton pendingText="보내는 중…">로그인 링크 받기</SubmitButton>
        </form>
      )}

      {error && (
        <p className="text-sm text-danger">
          {error === "callback"
            ? "링크가 만료됐거나 다른 브라우저에서 열렸어요. 다시 요청해 주세요."
            : error === "rate"
              ? "메일을 너무 자주 요청했어요. 방금 보낸 메일이 있다면 그 링크를 쓰고, 없다면 1분 뒤 다시 시도해 주세요."
              : "메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요."}
        </p>
      )}
    </main>
  );
}
