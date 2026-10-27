"use client";

import { useFormStatus } from "react-dom";

// 서버 액션이 끝날 때까지 버튼을 잠가서 중복 제출을 막는다
export default function SubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
