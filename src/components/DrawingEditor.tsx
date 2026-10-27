"use client";

import { getStroke } from "perfect-freehand";
import { memo, useCallback, useRef, useState } from "react";
import type { Drawing, Note, Paper, Stroke } from "@/lib/types";
import { saveLabel, useAutosave } from "@/lib/useAutosave";

// 페이지 논리 크기 (A4 비율). 화면 크기와 무관하게 이 좌표계로 저장해서 기기마다 같은 모양으로 보인다.
const W = 1000;
const H = 1414;

const COLORS = ["#1b1b1f", "#2f5bea", "#e03131", "#2b8a3e", "#f59f00"];
const SIZES = [3, 6, 12];
type Tool = "pen" | "highlighter" | "eraser";

// perfect-freehand 가 돌려준 외곽선 점들을 SVG path 로 변환 (라이브러리 README의 방식)
function toPath(points: number[][]): string {
  const len = points.length;
  if (len < 4) return "";
  const avg = (a: number, b: number) => (a + b) / 2;
  let a = points[0];
  let b = points[1];
  const c = points[2];
  let d = `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${b[0].toFixed(1)},${b[1].toFixed(1)} ${avg(b[0], c[0]).toFixed(1)},${avg(b[1], c[1]).toFixed(1)} T`;
  for (let i = 2; i < len - 1; i++) {
    a = points[i];
    b = points[i + 1];
    d += `${avg(a[0], b[0]).toFixed(1)},${avg(a[1], b[1]).toFixed(1)} `;
  }
  return d + "Z";
}

function strokePath(s: Stroke, simulatePressure: boolean) {
  return toPath(
    getStroke(s.points, {
      size: s.size,
      thinning: s.highlighter ? 0 : 0.55,
      smoothing: 0.5,
      streamline: 0.45,
      simulatePressure,
      last: true,
    }),
  );
}

// 점 (x, y)가 획의 어느 선분과 r 이내인지 검사.
// 점끼리만 비교하면 빠르게 그어 점 간격이 벌어진 획은 사이를 문질러도 안 지워진다.
function hitsStroke(s: Stroke, x: number, y: number, r: number): boolean {
  const pts = s.points;
  const r2 = r * r;
  if (pts.length === 1) return (pts[0][0] - x) ** 2 + (pts[0][1] - y) ** 2 < r2;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    // 선분 위에서 가장 가까운 점의 매개변수 t (0~1로 자름)
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    if ((ax + t * dx - x) ** 2 + (ay + t * dy - y) ** 2 < r2) return true;
  }
  return false;
}

const StrokeView = memo(function StrokeView({ s }: { s: Stroke }) {
  // 저장된 획은 필압 정보가 있으므로(마우스는 0.5 고정) 필압 시뮬레이션은 끈다
  return <path d={strokePath(s, false)} fill={s.color} opacity={s.highlighter ? 0.35 : 1} />;
});

function PaperBg({ paper }: { paper: Paper }) {
  if (paper === "blank") return null;
  const step = paper === "lined" ? 50 : 40;
  const lines = [];
  for (let y = paper === "lined" ? 120 : step; y < H; y += step) {
    lines.push(<line key={`h${y}`} x1={0} x2={W} y1={y} y2={y} />);
  }
  if (paper === "grid") {
    for (let x = step; x < W; x += step) lines.push(<line key={`v${x}`} x1={x} x2={x} y1={0} y2={H} />);
  }
  return <g stroke="#d6dbe3" strokeWidth={1}>{lines}</g>;
}

export default function DrawingEditor({ note }: { note: Note }) {
  const initial: Drawing = note.drawing ?? { version: 1, pages: [{ strokes: [] }] };
  const [title, setTitle] = useState(note.title);
  const [drawing, setDrawing] = useState<Drawing>(initial);
  const [undoStack, setUndoStack] = useState<Drawing[]>([]);
  const [redoStack, setRedoStack] = useState<Drawing[]>([]);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [penOnly, setPenOnly] = useState(false);
  const [live, setLive] = useState<{ page: number; stroke: Stroke; simulate: boolean } | null>(null);
  const { state, queue } = useAutosave(note.id);

  // 포인터 이벤트는 렌더보다 자주 오므로 최신 값은 ref 에 두고, state 는 화면 갱신용으로만 쓴다
  const liveRef = useRef(live);
  const drawingRef = useRef(drawing);
  const setLiveBoth = (v: typeof live) => {
    liveRef.current = v;
    setLive(v);
  };
  // 지우개는 한 번 드래그하는 동안 여러 번 바뀌므로, 드래그 시작 시점만 실행 취소 기록에 남긴다
  const eraseStart = useRef<Drawing | null>(null);
  const lastTouchY = useRef<number | null>(null);

  const commit = useCallback(
    (next: Drawing, recordHistory = true) => {
      if (recordHistory) {
        const prev = drawingRef.current; // 아래에서 ref 를 바꾸기 전에 이전 상태를 잡아 둔다
        setUndoStack((u) => [...u.slice(-99), prev]);
        setRedoStack([]);
      }
      drawingRef.current = next;
      setDrawing(next);
      queue({ drawing: next });
    },
    [queue],
  );

  const undo = () => {
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack((r) => [...r, drawing]);
    commit(prev, false);
  };
  const redo = () => {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(redoStack.slice(0, -1));
    setUndoStack((u) => [...u, drawing]);
    commit(next, false);
  };

  // 화면 좌표 → 페이지 논리 좌표
  const toLocal = (svg: SVGSVGElement, e: { clientX: number; clientY: number; pressure: number }) => {
    const r = svg.getBoundingClientRect();
    return [
      Math.round(((e.clientX - r.left) / r.width) * W * 10) / 10,
      Math.round(((e.clientY - r.top) / r.height) * H * 10) / 10,
      Math.round((e.pressure || 0.5) * 100) / 100,
    ] as [number, number, number];
  };

  const eraseAt = (page: number, x: number, y: number) => {
    const d = drawingRef.current;
    const radius = 14;
    const strokes = d.pages[page].strokes;
    const kept = strokes.filter((s) => !hitsStroke(s, x, y, radius + s.size / 2));
    if (kept.length === strokes.length) return;
    const pages = d.pages.map((p, i) => (i === page ? { strokes: kept } : p));
    commit({ ...d, pages }, false);
  };

  const onDown = (page: number) => (e: React.PointerEvent<SVGSVGElement>) => {
    if (penOnly && e.pointerType === "touch") {
      lastTouchY.current = e.clientY; // 펜 전용 모드에서 손가락은 스크롤로 사용
      return;
    }
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toLocal(e.currentTarget, e);
    if (tool === "eraser") {
      eraseStart.current = drawingRef.current;
      eraseAt(page, p[0], p[1]);
      return;
    }
    const hl = tool === "highlighter";
    setLiveBoth({
      page,
      simulate: e.pointerType !== "pen",
      stroke: { points: [p], color, size: hl ? size * 3 : size, ...(hl ? { highlighter: true } : {}) },
    });
  };

  const onMove = (page: number) => (e: React.PointerEvent<SVGSVGElement>) => {
    if (penOnly && e.pointerType === "touch") {
      if (lastTouchY.current != null) {
        window.scrollBy(0, lastTouchY.current - e.clientY);
        lastTouchY.current = e.clientY;
      }
      return;
    }
    if (!(e.buttons & 1) && e.pointerType === "mouse") return;
    const svg = e.currentTarget;
    // 빠르게 그을 때 브라우저가 합쳐 버린 중간 점들까지 가져와서 선을 매끄럽게
    // (미지원 브라우저는 undefined, 합성 이벤트는 빈 배열을 주므로 둘 다 원래 이벤트로 대체)
    const coalesced = e.nativeEvent.getCoalescedEvents?.();
    const events = coalesced?.length ? coalesced : [e.nativeEvent];
    if (tool === "eraser") {
      if (eraseStart.current) for (const ev of events) {
        const [x, y] = toLocal(svg, ev);
        eraseAt(page, x, y);
      }
      return;
    }
    const cur = liveRef.current;
    if (!cur || cur.page !== page) return;
    const pts = events.map((ev) => toLocal(svg, ev));
    setLiveBoth({ ...cur, stroke: { ...cur.stroke, points: [...cur.stroke.points, ...pts] } });
  };

  const onUp = () => {
    lastTouchY.current = null;
    if (eraseStart.current) {
      // 업데이트 함수는 나중에 실행되므로 ref 를 비우기 전에 값을 지역 변수로 잡아 둔다
      const before = eraseStart.current;
      eraseStart.current = null;
      // 드래그 동안 실제로 지운 게 있을 때만 실행 취소 기록 추가
      if (before !== drawingRef.current) {
        setUndoStack((u) => [...u.slice(-99), before]);
        setRedoStack([]);
      }
      return;
    }
    const cur = liveRef.current;
    if (!cur) return;
    setLiveBoth(null);
    // 마우스·손가락은 필압이 없어서, 저장할 때 perfect-freehand 의 시뮬레이션 결과에 가깝게 0.5로 고정
    const stroke = cur.simulate
      ? { ...cur.stroke, points: cur.stroke.points.map(([x, y]) => [x, y, 0.5] as [number, number, number]) }
      : cur.stroke;
    const d = drawingRef.current;
    const pages = d.pages.map((p, i) => (i === cur.page ? { strokes: [...p.strokes, stroke] } : p));
    commit({ ...d, pages });
  };

  const paper = drawing.paper ?? "lined";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
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
      </div>

      {/* 도구 모음: 스크롤해도 위에 붙어 있게 */}
      <div className="card sticky top-2 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 p-2 text-sm shadow-sm">
        <div className="flex gap-1">
          {(["pen", "highlighter", "eraser"] as Tool[]).map((t) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className={`rounded-md px-2.5 py-1 ${tool === t ? "bg-accent text-accent-fg" : "hover:bg-bg"}`}
            >
              {{ pen: "펜", highlighter: "형광펜", eraser: "지우개" }[t]}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                if (tool === "eraser") setTool("pen");
              }}
              aria-label={`색 ${c}`}
              className={`h-6 w-6 rounded-full border-2 ring-1 ring-line ${color === c ? "border-accent" : "border-transparent"}`}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              aria-label={`굵기 ${s}`}
              className={`flex h-7 w-7 items-center justify-center rounded-md ${size === s ? "bg-bg ring-1 ring-accent" : "hover:bg-bg"}`}
            >
              <span className="rounded-full bg-fg" style={{ width: s + 2, height: s + 2 }} />
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button className="btn-ghost" onClick={undo} disabled={!undoStack.length}>↶ 실행 취소</button>
          <button className="btn-ghost" onClick={redo} disabled={!redoStack.length}>↷</button>
        </div>
        <select
          value={paper}
          onChange={(e) => commit({ ...drawing, paper: e.target.value as Paper })}
          className="rounded-md border border-line bg-card px-2 py-1"
          aria-label="종이"
        >
          <option value="lined">줄 노트</option>
          <option value="grid">모눈</option>
          <option value="blank">무지</option>
        </select>
        <label className="flex items-center gap-1" title="손바닥·손가락 터치는 무시하고 펜으로만 그립니다">
          <input type="checkbox" checked={penOnly} onChange={(e) => setPenOnly(e.target.checked)} />
          펜 전용
        </label>
      </div>

      {drawing.pages.map((pg, i) => (
        <div key={i} className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full rounded-lg bg-white shadow-sm ring-1 ring-line"
            style={{ touchAction: "none", cursor: tool === "eraser" ? "cell" : "crosshair" }}
            onPointerDown={onDown(i)}
            onPointerMove={onMove(i)}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <PaperBg paper={paper} />
            {pg.strokes.map((s, j) => (
              <StrokeView key={j} s={s} />
            ))}
            {live?.page === i && (
              <path
                d={strokePath(live.stroke, live.simulate)}
                fill={live.stroke.color}
                opacity={live.stroke.highlighter ? 0.35 : 1}
              />
            )}
          </svg>
          <div className="mt-1 flex items-center justify-between text-xs text-muted">
            <span>{i + 1} / {drawing.pages.length}</span>
            {drawing.pages.length > 1 && (
              <button
                className="btn-ghost text-xs"
                onClick={() => {
                  if (pg.strokes.length && !confirm(`${i + 1}쪽을 삭제할까요?`)) return;
                  commit({ ...drawing, pages: drawing.pages.filter((_, k) => k !== i) });
                }}
              >
                이 쪽 삭제
              </button>
            )}
          </div>
        </div>
      ))}

      <button
        className="btn self-center"
        onClick={() => commit({ ...drawing, pages: [...drawing.pages, { strokes: [] }] })}
      >
        + 쪽 추가
      </button>
    </div>
  );
}
