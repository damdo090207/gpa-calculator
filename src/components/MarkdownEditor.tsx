"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Note } from "@/lib/types";
import { saveLabel, useAutosave } from "@/lib/useAutosave";

type View = "edit" | "split" | "preview";

export default function MarkdownEditor({ note }: { note: Note }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [view, setView] = useState<View>("split");
  const { state, queue } = useAutosave(note.id);

  // Tab 키로 들여쓰기 (기본 동작은 포커스 이동)
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: end } = el;
    const next = content.slice(0, s) + "  " + content.slice(end);
    setContent(next);
    queue({ content: next });
    requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            queue({ title: e.target.value || "제목 없음" });
          }}
          className="min-w-0 flex-1 bg-transparent text-xl font-bold outline-none"
          placeholder="제목"
          aria-label="노트 제목"
        />
        <span className={`text-xs ${state === "error" ? "text-danger" : "text-muted"}`}>{saveLabel(state)}</span>
        <div className="flex rounded-lg border border-line p-0.5 text-sm">
          {(["edit", "split", "preview"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-2.5 py-1 ${view === v ? "bg-accent text-accent-fg" : "text-muted"} ${v === "split" ? "hidden md:block" : ""}`}
            >
              {{ edit: "편집", split: "나란히", preview: "미리보기" }[v]}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-3 ${view === "split" ? "md:grid-cols-2" : ""}`}>
        {view !== "preview" && (
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              queue({ content: e.target.value });
            }}
            onKeyDown={onKeyDown}
            spellCheck={false}
            placeholder={"# 제목\n\n- 목록\n- **굵게**, *기울임*\n\n| 표 | 도 |\n|---|---|\n| 돼 | 요 |"}
            className="card min-h-[70dvh] resize-y p-4 font-mono text-sm leading-relaxed outline-none focus:border-accent"
          />
        )}
        {view !== "edit" && (
          <article className={`card markdown min-h-[70dvh] overflow-auto p-4 ${view === "split" ? "hidden md:block" : ""}`}>
            {content.trim() ? (
              // react-markdown 은 원본 HTML을 렌더링하지 않아서 XSS 걱정이 없다
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            ) : (
              <p className="text-muted">미리보기가 여기에 나타나요.</p>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
