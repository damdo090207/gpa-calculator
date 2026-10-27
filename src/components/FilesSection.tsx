"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CourseFile } from "@/lib/types";

const BUCKET = "course-files";
const MAX_BYTES = 50 * 1024 * 1024; // Supabase 무료 플랜 파일당 한도와 맞춤

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

// 스토리지 키는 한글·공백을 허용하지 않아서 확장자만 ASCII로 남긴다
function safeExt(name: string) {
  const m = /\.([A-Za-z0-9]{1,10})$/.exec(name);
  return m ? `.${m[1].toLowerCase()}` : "";
}

export default function FilesSection({
  courseId,
  userId,
  initialFiles,
}: {
  courseId: string;
  userId: string;
  initialFiles: CourseFile[];
}) {
  const [files, setFiles] = useState(initialFiles);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [supabase] = useState(createClient);

  async function upload(list: FileList | File[]) {
    setError(null);
    for (const file of Array.from(list)) {
      if (file.size > MAX_BYTES) {
        setError(`'${file.name}'은 50MB를 넘어서 올릴 수 없어요.`);
        continue;
      }
      setBusy(`'${file.name}' 올리는 중…`);
      // 경로 첫 폴더가 사용자 id 여야 스토리지 RLS 정책을 통과한다
      const path = `${userId}/${courseId}/${crypto.randomUUID()}${safeExt(file.name)}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (up.error) {
        setError(`'${file.name}' 업로드 실패: ${up.error.message}`);
        continue;
      }
      const { data, error } = await supabase
        .from("course_files")
        .insert({ course_id: courseId, name: file.name, storage_path: path, size: file.size, mime_type: file.type || null })
        .select("*")
        .single();
      if (error || !data) {
        // 메타데이터 저장이 실패하면 고아 파일이 남지 않게 객체도 지운다
        await supabase.storage.from(BUCKET).remove([path]);
        setError(`'${file.name}' 저장 실패`);
        continue;
      }
      setFiles((prev) => [data as CourseFile, ...prev]);
    }
    setBusy(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function open(f: CourseFile, download: boolean) {
    // 비공개 버킷이라 60초짜리 서명 URL을 만들어서 연다
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(f.storage_path, 60, download ? { download: f.name } : undefined);
    if (error || !data) return setError("파일 링크를 만들지 못했어요.");
    if (download) window.location.assign(data.signedUrl);
    else window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remove(f: CourseFile) {
    if (!confirm(`'${f.name}'을 삭제할까요?`)) return;
    const { error } = await supabase.storage.from(BUCKET).remove([f.storage_path]);
    if (error) return setError("파일을 삭제하지 못했어요.");
    await supabase.from("course_files").delete().eq("id", f.id);
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
  }

  const previewable = (f: CourseFile) =>
    !!f.mime_type && (f.mime_type.startsWith("image/") || f.mime_type === "application/pdf" || f.mime_type.startsWith("text/"));

  return (
    <div className="mt-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
        }}
        className={`card flex flex-col items-center gap-2 border-dashed px-4 py-6 text-center text-sm ${dragOver ? "border-accent bg-bg" : ""}`}
      >
        <p className="text-muted">파일을 여기로 끌어오거나</p>
        <button className="btn" onClick={() => inputRef.current?.click()} disabled={!!busy}>
          파일 선택
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
        <p className="text-xs text-muted">모든 형식 · 파일당 최대 50MB</p>
        {busy && <p className="text-accent">{busy}</p>}
        {error && <p className="text-danger">{error}</p>}
      </div>

      {files.length > 0 && (
        <ul className="card mt-3 divide-y divide-line">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate" title={f.name}>{f.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted">{formatSize(f.size)}</span>
              <div className="flex shrink-0">
                {previewable(f) && (
                  <button className="btn-ghost" onClick={() => open(f, false)}>보기</button>
                )}
                <button className="btn-ghost" onClick={() => open(f, true)}>받기</button>
                <button className="btn-ghost" onClick={() => remove(f)} aria-label="삭제">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
