'use client';

import { useState } from 'react';
import type { DailyTrafficPoint } from '@/lib/traffic';

// Napi forgalmi grafikon az admin statisztika oldalon: utolsó 30 nap,
// két sor (megtekintések = teal, affiliate kattintások = signal/narancs).
// SVG-komponens — nincs grafikon-könyvtár függőség; kliens-komponens csak a
// "napi értékek táblázatban" toggle miatt (a napok pontos kiolvasásához).
const W = 720;
const H = 220;
const PAD = { top: 14, right: 12, bottom: 26, left: 34 };

// Tengelymaximum "szép" kerekítésre (5, 10, 20, 50, 100, ...).
function niceMax(max: number): number {
  if (max <= 5) return 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 5, 10]) {
    if (max <= m * magnitude) return m * magnitude;
  }
  return 10 * magnitude;
}

// "2026-09-21" -> "09.21."
function huDate(day: string): string {
  const [, m, d] = day.split('-');
  return `${m}.${d}.`;
}

export default function DailyTrafficChart({ points }: { points: DailyTrafficPoint[] }) {
  const [showTable, setShowTable] = useState(false);

  if (points.length === 0 || points.every((p) => p.views === 0 && p.clicks === 0)) {
    return (
      <div className="rounded-card border border-line bg-white p-5">
        <h2 className="font-display text-lg font-bold text-ink">Napi forgalom (utolsó 30 nap)</h2>
        <p className="mt-2 font-body text-sm text-ink/60">
          Még nincs napi bontású adat — a napi mérés a bevezetése óta gyűlik, az oldalak látogatása
          tölti. Nézz vissza később.
        </p>
        <p className="mt-2 font-sans text-xs text-ink/40">
          (A korábbi teljes állomány a fenti összegző kártyákban és a cikktáblázatban látható.)
        </p>
      </div>
    );
  }

  const max = niceMax(Math.max(...points.map((p) => p.views)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (i * innerW) / (points.length - 1));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const toPath = (get: (p: DailyTrafficPoint) => number) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(get(p)).toFixed(1)}`).join(' ');

  const viewsPath = toPath((p) => p.views);
  const clicksPath = toPath((p) => p.clicks);
  const areaPath = `${viewsPath} L${x(points.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

  // Heti rácsvonalak (minden 7. nap) + az utolsó nap felirata
  const gridIdx = points
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i % 7 === 0 || i === points.length - 1);
  const total30v = points.reduce((s, p) => s + p.views, 0);
  const total30c = points.reduce((s, p) => s + p.clicks, 0);

  return (
    <div className="rounded-card border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-ink">Napi forgalom (utolsó 30 nap)</h2>
        <div className="flex items-center gap-4 font-sans text-xs text-ink/60">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-teal-500" aria-hidden="true" />
            Megtekintések ({total30v})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-signal-500" aria-hidden="true" />
            Kattintások ({total30c})
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-auto w-full"
        role="img"
        aria-label="Napi forgalom az elmúlt 30 napban: megtekintések és affiliate kattintások"
      >
        <defs>
          <linearGradient id="traffic-views-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0E6E63" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0E6E63" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* x-tengely: heti rácsvonalak + dátumfeliratok */}
        {gridIdx.map(({ p, i }) => (
          <g key={p.day}>
            <line x1={x(i)} y1={PAD.top} x2={x(i)} y2={PAD.top + innerH} stroke="#DCE0DA" strokeDasharray="2 3" />
            <text
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize="10"
              fill="#12191A"
              opacity="0.45"
              fontFamily="system-ui, sans-serif"
            >
              {huDate(p.day)}
            </text>
          </g>
        ))}

        {/* y-tengely: vízszintes rácsvonalak + értékfeliratok */}
        {[0, max / 2, max].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              y1={y(v)}
              x2={W - PAD.right}
              y2={y(v)}
              stroke="#DCE0DA"
              strokeDasharray="2 3"
              opacity="0.6"
            />
            <text
              x={PAD.left - 6}
              y={y(v) + 3}
              textAnchor="end"
              fontSize="10"
              fill="#12191A"
              opacity="0.45"
              fontFamily="system-ui, sans-serif"
            >
              {v}
            </text>
          </g>
        ))}

        {/* megtekintések: gradient terület + vonal; kattintások: vonal */}
        <path d={areaPath} fill="url(#traffic-views-gradient)" />
        <path d={viewsPath} fill="none" stroke="#0E6E63" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={clicksPath} fill="none" stroke="#E8542A" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>

      <button
        type="button"
        onClick={() => setShowTable((v) => !v)}
        className="mt-2 font-sans text-xs font-medium text-teal-600 hover:text-teal-700"
      >
        {showTable ? 'Táblázat elrejtése' : 'Napi értékek táblázatban'}
      </button>

      {showTable && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-tight border border-line">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line font-sans text-xs uppercase tracking-wide text-ink/40">
                <th className="px-3 py-2 font-medium">Nap</th>
                <th className="px-3 py-2 text-right font-medium">Megtekintések</th>
                <th className="px-3 py-2 text-right font-medium">Kattintások</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-sans text-sm">
              {[...points].reverse().map((p) => (
                <tr key={p.day}>
                  <td className="px-3 py-1.5 text-ink/70">{p.day}</td>
                  <td className="px-3 py-1.5 text-right text-ink">{p.views}</td>
                  <td className="px-3 py-1.5 text-right text-ink">{p.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
