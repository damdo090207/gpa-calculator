"use client";

import { useEffect, useRef, useState } from "react";
import { formatGpa, maxPoint, termLabel, type Scale, type TrendPoint } from "@/lib/gpa";

// 학기별 평점 변화 그래프: 학기 평점(파랑)과 누적 평점(주황), 목표 평점(점선)
const H = 220;
const PAD = { top: 16, right: 72, bottom: 30, left: 36 };

export default function GpaChart({
  points,
  scale,
  target,
}: {
  points: TrendPoint[];
  scale: Scale;
  target: number | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  // 카드 너비에 맞춰 다시 그린다 (글자 크기가 줄어들지 않게 viewBox 대신 실제 픽셀 너비 사용)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length === 0) {
    return (
      <section className="card mt-4 p-5">
        <h2 className="font-semibold">평점 변화</h2>
        <p className="mt-2 text-sm text-muted">성적이 나온 학기가 생기면 학기별 평점 변화를 그래프로 보여 드려요.</p>
      </section>
    );
  }

  const max = maxPoint(scale);
  const showTarget = target != null && target <= max;
  const values = points.flatMap((p) => [p.semesterGpa, p.cumulativeGpa]).concat(showTarget ? [target] : []);
  // 세로축: 0.5 단위로, 가장 낮은 값보다 조금 아래부터 만점까지
  const yMin = Math.max(0, Math.floor((Math.min(...values) - 0.25) * 2) / 2);
  const yMax = max;
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += 0.5) ticks.push(Number(v.toFixed(1)));

  const plotW = width - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  // 첫·마지막 점이 세로축 값이나 가장자리에 붙지 않도록 양옆을 조금 비운다
  const INSET = 28;
  const x = (i: number) =>
    PAD.left + (points.length === 1 ? plotW / 2 : INSET + ((plotW - 2 * INSET) * i) / (points.length - 1));
  const y = (v: number) => PAD.top + plotH * (1 - (v - yMin) / (yMax - yMin));
  const path = (key: "semesterGpa" | "cumulativeGpa") =>
    points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p[key])}`).join("");

  // 학기가 많아 좁으면 가로축 이름을 건너뛰며 표시
  const step = Math.ceil(points.length / Math.max(1, Math.floor(plotW / 64)));
  const last = points[points.length - 1];

  // 오른쪽 끝 값 이름표: 두 값이 가까우면 위아래로 벌린다
  let ySem = y(last.semesterGpa);
  let yCum = y(last.cumulativeGpa);
  if (Math.abs(ySem - yCum) < 16) {
    const mid = (ySem + yCum) / 2;
    const up = last.semesterGpa >= last.cumulativeGpa;
    ySem = mid + (up ? -8 : 8);
    yCum = mid + (up ? 8 : -8);
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    points.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setHover(best);
  };

  const hp = hover != null ? points[hover] : null;

  return (
    <section className="card mt-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">평점 변화</h2>
        <div className="flex items-center gap-4 text-xs text-muted">
          <Key color="var(--series-1)" label="학기 평점" />
          <Key color="var(--series-2)" label="누적 평점" />
          {showTarget && <Key color="var(--muted)" label="목표" dashed />}
        </div>
      </div>

      <div ref={box} className="relative mt-3">
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={`학기별 평점 그래프. 마지막 학기 평점 ${formatGpa(last.semesterGpa)}, 누적 평점 ${formatGpa(last.cumulativeGpa)}`}
          className="block touch-pan-y select-none"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {/* 가로 눈금선과 세로축 값 */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">
                {t.toFixed(1)}
              </text>
            </g>
          ))}

          {/* 가로축 학기 이름 */}
          {points.map((p, i) =>
            i % step === 0 || i === points.length - 1 ? (
              <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--muted)">
                {String(p.year).slice(2)}년 {termLabel(p.term)}
              </text>
            ) : null,
          )}

          {/* 목표 평점 기준선 */}
          {showTarget && (
            <g>
              <line
                x1={PAD.left} x2={PAD.left + plotW} y1={y(target)} y2={y(target)}
                stroke="var(--muted)" strokeWidth={1} strokeDasharray="4 4"
              />
              <text x={PAD.left + 4} y={y(target) - 5} fontSize={11} fill="var(--muted)">
                목표 {formatGpa(target)}
              </text>
            </g>
          )}

          {/* 호버 세로선 */}
          {hover != null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--muted)" strokeWidth={1} />
          )}

          {/* 선 */}
          {(["cumulativeGpa", "semesterGpa"] as const).map((k) => (
            <path
              key={k}
              d={path(k)}
              fill="none"
              stroke={k === "semesterGpa" ? "var(--series-1)" : "var(--series-2)"}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* 점: 바탕색 테두리로 선이 겹쳐도 보이게 */}
          {points.map((p, i) =>
            (["cumulativeGpa", "semesterGpa"] as const).map((k) => (
              <circle
                key={`${k}${i}`}
                cx={x(i)}
                cy={y(p[k])}
                r={hover === i ? 5.5 : 4}
                fill={k === "semesterGpa" ? "var(--series-1)" : "var(--series-2)"}
                stroke="var(--card)"
                strokeWidth={2}
              />
            )),
          )}

          {/* 오른쪽 끝 값 이름표 (글자는 본문 색, 색은 옆의 점이 담당) */}
          <text x={x(points.length - 1) + 10} y={ySem} dy="0.32em" fontSize={12} fill="var(--fg)">
            학기 {formatGpa(last.semesterGpa)}
          </text>
          <text x={x(points.length - 1) + 10} y={yCum} dy="0.32em" fontSize={12} fill="var(--fg)">
            누적 {formatGpa(last.cumulativeGpa)}
          </text>
        </svg>

        {/* 호버 설명 상자 */}
        {hp && hover != null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm"
            style={{ left: Math.min(Math.max(x(hover) - 70, 0), width - 150), width: 150 }}
          >
            <div className="font-semibold">{hp.year}년 {termLabel(hp.term)}</div>
            <Row color="var(--series-1)" label="학기 평점" value={formatGpa(hp.semesterGpa)} />
            <Row color="var(--series-2)" label="누적 평점" value={formatGpa(hp.cumulativeGpa)} />
          </div>
        )}
      </div>

      {points.length === 1 && (
        <p className="mt-2 text-xs text-muted">성적이 나온 학기가 2개 이상이면 변화가 선으로 이어져요.</p>
      )}

      {/* 표로 보기: 색을 구분하기 어려워도 값을 읽을 수 있게 */}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted">표로 보기</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 font-normal">학기</th>
              <th className="py-1 text-right font-normal">학기 평점</th>
              <th className="py-1 text-right font-normal">누적 평점</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={`${p.year}${p.term}`} className="border-t border-line">
                <td className="py-1">{p.year}년 {termLabel(p.term)}</td>
                <td className="py-1 text-right">{formatGpa(p.semesterGpa)}</td>
                <td className="py-1 text-right">{formatGpa(p.cumulativeGpa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function Key({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width={16} height={8} aria-hidden>
        <line x1={0} x2={16} y1={4} y2={4} stroke={color} strokeWidth={2} strokeDasharray={dashed ? "3 3" : undefined} />
      </svg>
      {label}
    </span>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="mt-1 flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-muted">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
