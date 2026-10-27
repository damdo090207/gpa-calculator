"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type SaveState = "saved" | "dirty" | "saving" | "error";

// 노트 필드를 바꾸면 delay(ms) 동안 추가 입력이 없을 때 한 번에 저장한다.
// 페이지를 떠날 때 저장이 남아 있으면 브라우저 경고를 띄운다.
export function useAutosave(noteId: string, delay = 800) {
  const [state, setState] = useState<SaveState>("saved");
  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabaseRef = useRef(createClient());

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    if (!Object.keys(patch).length) return;
    pending.current = {};
    setState("saving");
    const { error } = await supabaseRef.current.from("notes").update(patch).eq("id", noteId);
    if (error) {
      // 실패한 내용은 다시 대기열로 돌려서 다음 저장 때 재시도
      pending.current = { ...patch, ...pending.current };
      setState("error");
    } else {
      setState(Object.keys(pending.current).length ? "dirty" : "saved");
    }
  }, [noteId]);

  const queue = useCallback(
    (patch: Record<string, unknown>) => {
      pending.current = { ...pending.current, ...patch };
      setState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [flush, delay],
  );

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) {
        flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      flush(); // 다른 페이지로 이동(언마운트)할 때 남은 내용 저장
    };
  }, [flush]);

  return { state, queue, flush };
}

export function saveLabel(s: SaveState) {
  return { saved: "저장됨", dirty: "입력 중…", saving: "저장 중…", error: "저장 실패 · 재시도 대기" }[s];
}
