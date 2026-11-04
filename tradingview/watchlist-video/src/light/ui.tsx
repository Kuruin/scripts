import React from "react";
import { random } from "remotion";
import { fmt, fontFamily, hueOf, type Sym } from "../theme";
import { Icon, LogoMark } from "../ui";

// The extension's light theme (styles.css :root), which follows TradingView's.
export const L = {
  canvas: "#f6f7f9",
  bg: "#ffffff",
  bg2: "#f0f3fa",
  border: "#e0e3eb",
  text: "#131722",
  text2: "#6a6d78",
  text3: "#a3a6af",
  accent: "#2962ff",
  accentSoft: "rgba(41,98,255,.09)",
  selected: "#e9ecf2",
  up: "#089981",
  down: "#f23645",
  shadow: "0 1px 2px rgba(19,23,34,.06), 0 12px 32px rgba(19,23,34,.10)",
};

// Dockside's own brand colours, for the video's titles, highlights and calls to action.
// The product UI keeps TradingView's blue so it looks exactly like the extension.
export const BRAND = {
  accent: "#0b7f86",
  accentSoft: "rgba(11,127,134,.11)",
  ink: "#10191b",
  canvasTop: "#fbfaf6",
  canvasBottom: "#edf3f1",
};

export const LAvatar: React.FC<{ t: string; s: number }> = ({ t, s }) => {
  const h = hueOf(t);
  return (
    <div
      style={{
        width: 22 * s,
        height: 22 * s,
        flex: "0 0 auto",
        borderRadius: "50%",
        background: `hsl(${h} 70% 50% / .12)`,
        color: `hsl(${h} 60% 40%)`,
        fontSize: 10.5 * s,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {t[0]}
    </div>
  );
};

export const LBadge: React.FC<{ ex: string; s: number; active?: boolean }> = ({ ex, s, active }) => (
  <span
    style={{
      fontSize: 9 * s,
      fontWeight: 700,
      lineHeight: `${13 * s}px`,
      padding: `0 ${4 * s}px`,
      borderRadius: 3 * s,
      border: `1px solid ${active ? L.accent : L.border}`,
      color: active ? L.accent : L.text2,
      background: active ? L.accentSoft : L.bg2,
      flex: "0 0 auto",
    }}
  >
    {ex}
  </span>
);

export const LRow: React.FC<{ sym: Sym; s: number; current?: boolean; hover?: boolean }> = ({ sym, s, current, hover }) => {
  const up = sym.pct >= 0;
  const abs = (sym.p * sym.pct) / (100 + sym.pct);
  return (
    <div
      style={{
        height: 40 * s,
        display: "flex",
        alignItems: "center",
        gap: 8 * s,
        padding: `0 ${10 * s}px 0 ${8 * s}px`,
        position: "relative",
        background: current ? L.accentSoft : hover ? L.bg2 : "transparent",
      }}
    >
      {current ? <div style={{ position: "absolute", left: 0, top: 6 * s, bottom: 6 * s, width: 2.5 * s, borderRadius: 2 * s, background: L.accent }} /> : null}
      <div style={{ width: 10 * s, display: "flex" }}>{sym.tag ? <Icon d="bookmark" size={11 * s} color={sym.tag} fill={sym.tag} /> : null}</div>
      <LAvatar t={sym.t} s={s} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 * s, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13 * s, fontWeight: 700, color: current ? L.accent : L.text, whiteSpace: "nowrap" }}>{sym.t}</span>
        <LBadge ex={sym.ex} s={s} active={current} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 * s, fontVariantNumeric: "tabular-nums" }}>
        <span style={{ fontSize: 13 * s, fontWeight: 600, color: L.text }}>{fmt(sym.p)}</span>
        <span style={{ fontSize: 10.5 * s, fontWeight: 600, color: up ? L.up : L.down }}>
          {up ? "+" : "−"}
          {fmt(Math.abs(abs))} {up ? "+" : "−"}
          {fmt(Math.abs(sym.pct))}%
        </span>
      </div>
    </div>
  );
};

export const LDock: React.FC<{ s: number; width: number; height: number; children: React.ReactNode; count?: string; style?: React.CSSProperties }> = ({
  s,
  width,
  height,
  children,
  count = "39 / 1,000",
  style,
}) => (
  <div
    style={{
      width,
      height,
      background: L.bg,
      borderRadius: 8 * s,
      border: `1px solid ${L.border}`,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      fontFamily,
      color: L.text,
      ...style,
    }}
  >
    <div style={{ height: 42 * s, flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6 * s, padding: `0 ${8 * s}px 0 ${10 * s}px`, borderBottom: `1px solid ${L.border}` }}>
      <div style={{ width: 16 * s, height: 16 * s, borderRadius: "50%", background: L.down }} />
      <span style={{ fontSize: 14 * s, fontWeight: 700, marginLeft: 2 * s }}>CB</span>
      <Icon d="chev" size={12 * s} color={L.text3} />
      <div style={{ flex: 1 }} />
      {(["search", "plus", "dots", "minimize"] as const).map((d) => (
        <div key={d} style={{ width: 26 * s, height: 26 * s, display: "flex", alignItems: "center", justifyContent: "center", color: L.text2 }}>
          <Icon d={d} size={15 * s} />
        </div>
      ))}
    </div>
    <div style={{ flex: 1, overflow: "hidden", paddingTop: 4 * s }}>
      <div style={{ height: 30 * s, display: "flex", alignItems: "center", gap: 6 * s, padding: `0 ${10 * s}px`, color: L.text2, fontSize: 11 * s, fontWeight: 600 }}>
        <Icon d="chev" size={11 * s} color={L.text3} />
        <span style={{ flex: 1 }}>Watching</span>
        <span>8</span>
      </div>
      {children}
    </div>
    <div style={{ height: 30 * s, flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6 * s, padding: `0 ${10 * s}px`, borderTop: `1px solid ${L.border}`, fontSize: 11 * s, color: L.text2 }}>
      <div style={{ width: 6 * s, height: 6 * s, borderRadius: "50%", background: L.up }} />
      <span style={{ color: L.text }}>Live</span>
      <span>· just now</span>
      <div style={{ flex: 1 }} />
      <Icon d="sync" size={13 * s} color={L.text2} />
      <span style={{ marginLeft: 6 * s, fontVariantNumeric: "tabular-nums" }}>{count}</span>
    </div>
  </div>
);

export const LChart: React.FC<{ seed: string; width: number; height: number; candles?: number }> = ({ seed, width, height, candles = 56 }) => {
  const data: { o: number; c: number; h: number; l: number }[] = [];
  let v = 100;
  for (let i = 0; i < candles; i++) {
    const o = v;
    const c = v + (random(`${seed}-d-${i}`) - 0.46) * 6;
    data.push({ o, c, h: Math.max(o, c) + random(`${seed}-h-${i}`) * 3, l: Math.min(o, c) - random(`${seed}-l-${i}`) * 3 });
    v = c;
  }
  const max = Math.max(...data.map((d) => d.h));
  const min = Math.min(...data.map((d) => d.l));
  const y = (val: number) => 14 + ((max - val) / (max - min)) * (height - 28);
  const step = width / candles;
  return (
    <svg width={width} height={height}>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={0} x2={width} y1={height * g} y2={height * g} stroke="#eef0f4" />
      ))}
      {data.map((d, i) => {
        const col = d.c >= d.o ? L.up : L.down;
        const x = i * step + step / 2;
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y(d.h)} y2={y(d.l)} stroke={col} strokeWidth={1.2} />
            <rect x={x - step * 0.32} width={step * 0.64} y={y(Math.max(d.o, d.c))} height={Math.max(1.2, Math.abs(y(d.o) - y(d.c)))} fill={col} rx={0.8} />
          </g>
        );
      })}
    </svg>
  );
};

// TradingView's light chart page, with room on the right for the dock.
export const LWindow: React.FC<{
  width: number;
  height: number;
  symbol: string;
  price: string;
  pct: number;
  dockWidth: number;
  dock?: React.ReactNode;
  btnActive?: boolean;
  children?: React.ReactNode;
}> = ({ width, height, symbol, price, pct, dockWidth, dock, btnActive, children }) => {
  const top = 38;
  const side = 38;
  const chartW = width - side * 2 - dockWidth - (dockWidth > 0 ? 3 : 0);
  return (
    <div style={{ width, height, background: L.bg, borderRadius: 12, overflow: "hidden", position: "relative", fontFamily, color: L.text, boxShadow: L.shadow, border: `1px solid ${L.border}` }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: top, display: "flex", alignItems: "center", gap: 12, padding: "0 14px", borderBottom: `1px solid ${L.border}` }}>
        <span style={{ fontWeight: 700, fontSize: 13, padding: "4px 9px", borderRadius: 6, background: L.bg2 }}>{symbol}</span>
        <span style={{ fontSize: 12, color: L.text2, fontWeight: 600 }}>1D</span>
        <span style={{ fontSize: 12, color: L.text2 }}>Indicators</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{price}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: pct >= 0 ? L.up : L.down }}>
          {pct >= 0 ? "+" : "−"}
          {fmt(Math.abs(pct))}%
        </span>
      </div>
      <div style={{ position: "absolute", left: 0, top, bottom: 0, width: side, borderRight: `1px solid ${L.border}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 14 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ width: 14, height: 2, background: L.text3, borderRadius: 2, boxShadow: `0 4px 0 ${L.text3}` }} />
        ))}
      </div>
      <div style={{ position: "absolute", left: side, top, width: chartW, bottom: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 14, top: 10, fontSize: 12, color: L.text2, fontWeight: 600 }}>
          <span style={{ color: L.text, fontWeight: 700 }}>{symbol}</span> · 1D · NSE
        </div>
        <div style={{ position: "absolute", left: 0, top: 28 }}>
          <LChart seed={symbol} width={chartW - 40} height={height - top - 40} />
        </div>
      </div>
      {dockWidth > 0 ? <div style={{ position: "absolute", right: side + 3, top: top + 3, width: dockWidth, bottom: 3, overflow: "hidden" }}>{dock}</div> : null}
      <div style={{ position: "absolute", right: 0, top, bottom: 0, width: side, borderLeft: `1px solid ${L.border}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, paddingTop: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: btnActive ? L.accentSoft : "transparent" }}>
          <LogoMark size={24} color={btnActive ? L.accent : L.text2} />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${L.text3}` }} />
        ))}
      </div>
      {children}
    </div>
  );
};

// The minimized pill in TradingView's light theme.
export const LPill: React.FC<{ t: string; n: number; total: number; s: number }> = ({ t, n, total, s }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 2 * s,
      padding: 3 * s,
      borderRadius: 10 * s,
      background: "rgba(255,255,255,.96)",
      color: L.text,
      boxShadow: `0 ${4 * s}px ${12 * s}px rgba(19,23,34,.12), inset 0 0 0 1px rgba(19,23,34,.08)`,
      fontFamily,
    }}
  >
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 * s, padding: `${3 * s}px ${7 * s}px` }}>
      <span style={{ fontSize: 13 * s, fontWeight: 700 }}>{t}</span>
      <span style={{ fontSize: 11 * s, fontVariantNumeric: "tabular-nums", color: L.text2 }}>
        {n}/{total}
      </span>
    </div>
    {(["up", "down"] as const).map((d) => (
      <div key={d} style={{ width: 20 * s, height: 20 * s, display: "flex", alignItems: "center", justifyContent: "center", color: L.text2 }}>
        <Icon d={d} size={12 * s} width={2.4} />
      </div>
    ))}
  </div>
);

export const LKey: React.FC<{ label: string; down: boolean; size?: number }> = ({ label, down, size = 64 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.22,
      background: down ? L.accentSoft : L.bg,
      border: `1px solid ${down ? L.accent : L.border}`,
      boxShadow: down ? "0 1px 0 rgba(19,23,34,.08)" : "0 4px 0 #dfe2e9",
      translate: down ? "0px 3px" : "0px 0px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: down ? L.accent : L.text,
      fontFamily,
      fontWeight: 700,
      fontSize: size * 0.42,
    }}
  >
    {label}
  </div>
);

// A symbol card: used as the faces of the "1,000 symbols" grid.
export const SymbolCard: React.FC<{ t: string; p: number; pct: number }> = ({ t, p, pct }) => (
  <div style={{ width: 360, height: 480, background: L.bg, fontFamily, color: L.text, display: "flex", flexDirection: "column", padding: 28, gap: 6, boxSizing: "border-box" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <LAvatar t={t} s={2} />
      <LBadge ex="NSE" s={1.8} />
    </div>
    <span style={{ fontSize: 40, fontWeight: 800, marginTop: 14 }}>{t}</span>
    <span style={{ fontSize: 30, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt(p)}</span>
    <span style={{ fontSize: 24, fontWeight: 700, color: pct >= 0 ? L.up : L.down }}>
      {pct >= 0 ? "+" : "−"}
      {fmt(Math.abs(pct))}%
    </span>
    <div style={{ marginTop: "auto" }}>
      <LChart seed={t} width={304} height={180} candles={26} />
    </div>
  </div>
);
