import React from "react";
import { random } from "remotion";
import { C, fmt, fontFamily, hueOf, type Sym } from "./theme";

/* ---------- icons (Lucide-style outlines, like the extension's sprite) ---------- */
const P = {
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  plus: "M12 5v14M5 12h14",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  minimize: "M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7",
  sync: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5",
  chev: "m6 9 6 6 6-6",
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
  copy: "M8 8h12v12H8zM4 16V4h12",
  check: "M20 6 9 17l-5-5",
  x: "M18 6 6 18M6 6l12 12",
  bookmark: "M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
};
export const Icon: React.FC<{ d: keyof typeof P; size: number; color?: string; fill?: string; width?: number }> = ({
  d,
  size,
  color = "currentColor",
  fill = "none",
  width = 2,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
    <path d={P[d]} />
  </svg>
);

// The extension's toolbar icon: three lines and a bookmark.
export const LogoMark: React.FC<{ size: number; color?: string }> = ({ size, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
    <path fill={color} d="M10 13h22v2.4H10zm0 8h22v2.4H10zm0 8h12v2.4H10z" />
    <path fill={color} d="M26 26h9v12l-4.5-2.8L26 38zm1.6 1.6v7.5l2.9-1.8 2.9 1.8v-7.5z" />
  </svg>
);

/* ---------- the dock ---------- */
export const Avatar: React.FC<{ t: string; s: number }> = ({ t, s }) => {
  const h = hueOf(t);
  return (
    <div
      style={{
        width: 22 * s,
        height: 22 * s,
        flex: "0 0 auto",
        borderRadius: "50%",
        background: `hsl(${h} 55% 50% / .18)`,
        color: `hsl(${h} 65% 62%)`,
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

export const Badge: React.FC<{ ex: string; s: number; active?: boolean }> = ({ ex, s, active }) => (
  <span
    style={{
      fontSize: 9 * s,
      fontWeight: 700,
      letterSpacing: ".03em",
      lineHeight: `${13 * s}px`,
      padding: `0 ${4 * s}px`,
      borderRadius: 3 * s,
      border: `${Math.max(1, s * 0.8)}px solid ${active ? C.blue : C.line}`,
      color: active ? "#7aa2ff" : C.muted,
      background: "rgba(255,255,255,.04)",
      flex: "0 0 auto",
    }}
  >
    {ex}
  </span>
);

export type RowState = { price?: number; pct?: number; flash?: "up" | "down" | null };

export const Row: React.FC<{
  sym: Sym;
  s: number;
  current?: boolean;
  hover?: boolean;
  state?: RowState;
}> = ({ sym, s, current, hover, state }) => {
  const price = state?.price ?? sym.p;
  const pct = state?.pct ?? sym.pct;
  const dec = sym.dec ?? 2;
  const abs = (price * pct) / (100 + pct);
  const up = pct >= 0;
  const flash = state?.flash;
  return (
    <div
      style={{
        height: 40 * s,
        display: "flex",
        alignItems: "center",
        gap: 8 * s,
        padding: `0 ${10 * s}px 0 ${8 * s}px`,
        position: "relative",
        background: current ? "rgba(41,98,255,.13)" : hover ? "rgba(255,255,255,.04)" : "transparent",
      }}
    >
      {current ? (
        <div style={{ position: "absolute", left: 0, top: 6 * s, bottom: 6 * s, width: 2.5 * s, borderRadius: 2 * s, background: C.blue }} />
      ) : null}
      <div style={{ width: 10 * s, color: sym.tag ?? "transparent", display: "flex" }}>
        {sym.tag ? <Icon d="bookmark" size={11 * s} color={sym.tag} fill={sym.tag} /> : null}
      </div>
      <Avatar t={sym.t} s={s} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 * s, flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 13 * s,
            fontWeight: 700,
            color: current ? "#9db8ff" : C.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {sym.t}
        </span>
        <Badge ex={sym.ex} s={s} active={current} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 * s, fontVariantNumeric: "tabular-nums" }}>
        <span
          style={{
            fontSize: 13 * s,
            fontWeight: 600,
            color: flash === "up" ? C.up : flash === "down" ? C.down : C.text,
          }}
        >
          {fmt(price, dec)}
        </span>
        <span style={{ fontSize: 10.5 * s, fontWeight: 600, color: up ? C.up : C.down }}>
          {up ? "+" : "−"}
          {fmt(Math.abs(abs), dec)} {up ? "+" : "−"}
          {fmt(Math.abs(pct), 2)}%
        </span>
      </div>
    </div>
  );
};

export const SectionRow: React.FC<{ name: string; count: number; s: number }> = ({ name, count, s }) => (
  <div
    style={{
      height: 30 * s,
      display: "flex",
      alignItems: "center",
      gap: 6 * s,
      padding: `0 ${10 * s}px`,
      color: C.muted,
      fontSize: 10.5 * s,
      fontWeight: 700,
      letterSpacing: ".06em",
    }}
  >
    <Icon d="chev" size={11 * s} color={C.muted} />
    <span style={{ flex: 1 }}>{name.toUpperCase()}</span>
    <span style={{ fontWeight: 600 }}>{count}</span>
  </div>
);

export const Dock: React.FC<{
  s: number;
  width: number;
  height: number;
  listName?: string;
  listColor?: string;
  count?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ s, width, height, listName = "CB", listColor = C.down, count = "39 / 1,000", footer, children, style }) => (
  <div
    style={{
      width,
      height,
      background: C.panel,
      borderRadius: 8 * s,
      border: `1px solid ${C.line}`,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      fontFamily,
      color: C.text,
      position: "relative",
      ...style,
    }}
  >
    <div style={{ height: 42 * s, display: "flex", alignItems: "center", gap: 6 * s, padding: `0 ${8 * s}px 0 ${10 * s}px`, borderBottom: `1px solid ${C.line}` }}>
      <div style={{ width: 16 * s, height: 16 * s, borderRadius: "50%", background: listColor }} />
      <span style={{ fontSize: 14 * s, fontWeight: 700, marginLeft: 2 * s }}>{listName}</span>
      <Icon d="chev" size={12 * s} color={C.muted} />
      <div style={{ flex: 1 }} />
      {(["search", "plus", "dots", "minimize"] as const).map((d) => (
        <div key={d} style={{ width: 26 * s, height: 26 * s, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
          <Icon d={d} size={15 * s} />
        </div>
      ))}
    </div>
    <div style={{ flex: 1, overflow: "hidden", paddingTop: 4 * s, position: "relative" }}>{children}</div>
    <div
      style={{
        height: 30 * s,
        display: "flex",
        alignItems: "center",
        gap: 6 * s,
        padding: `0 ${10 * s}px`,
        borderTop: `1px solid ${C.line}`,
        fontSize: 11 * s,
        color: C.muted,
      }}
    >
      {footer ?? (
        <>
          <div style={{ width: 6 * s, height: 6 * s, borderRadius: "50%", background: C.up }} />
          <span style={{ color: C.text }}>Live</span>
          <span>· just now</span>
          <div style={{ flex: 1 }} />
          <Icon d="sync" size={13 * s} color={C.muted} />
          <span style={{ marginLeft: 6 * s, fontVariantNumeric: "tabular-nums" }}>{count}</span>
        </>
      )}
    </div>
  </div>
);

/* ---------- candlestick chart ---------- */
export const Chart: React.FC<{ seed: string; width: number; height: number; candles?: number; opacity?: number }> = ({
  seed,
  width,
  height,
  candles = 64,
  opacity = 1,
}) => {
  const data: { o: number; c: number; h: number; l: number }[] = [];
  let v = 100;
  for (let i = 0; i < candles; i++) {
    const drift = (random(`${seed}-d-${i}`) - 0.46) * 6;
    const o = v;
    const c = v + drift;
    const h = Math.max(o, c) + random(`${seed}-h-${i}`) * 3;
    const l = Math.min(o, c) - random(`${seed}-l-${i}`) * 3;
    data.push({ o, c, h, l });
    v = c;
  }
  const max = Math.max(...data.map((d) => d.h));
  const min = Math.min(...data.map((d) => d.l));
  const y = (val: number) => 20 + ((max - val) / (max - min)) * (height - 40);
  const step = width / candles;
  const last = data[data.length - 1];
  return (
    <svg width={width} height={height} style={{ opacity }}>
      {[0.2, 0.4, 0.6, 0.8].map((g) => (
        <line key={g} x1={0} x2={width} y1={height * g} y2={height * g} stroke="rgba(255,255,255,.04)" />
      ))}
      {data.map((d, i) => {
        const up = d.c >= d.o;
        const x = i * step + step / 2;
        const col = up ? C.up : C.down;
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y(d.h)} y2={y(d.l)} stroke={col} strokeWidth={1.4} />
            <rect x={x - step * 0.32} width={step * 0.64} y={y(Math.max(d.o, d.c))} height={Math.max(1.5, Math.abs(y(d.o) - y(d.c)))} fill={col} rx={1} />
          </g>
        );
      })}
      <line x1={0} x2={width} y1={y(last.c)} y2={y(last.c)} stroke={last.c >= last.o ? C.up : C.down} strokeDasharray="3 4" strokeWidth={1} />
    </svg>
  );
};

/* ---------- a TradingView-like window ---------- */
export const TVWindow: React.FC<{
  width: number;
  height: number;
  symbol: string;
  price: string;
  pct: number;
  dockWidth: number;
  dock?: React.ReactNode;
  overlay?: React.ReactNode;
  btnActive?: boolean;
}> = ({ width, height, symbol, price, pct, dockWidth, dock, overlay, btnActive }) => {
  const top = 46;
  const left = 46;
  const right = 46;
  const bottom = 30;
  const chartW = width - left - right - dockWidth - (dockWidth > 0 ? 4 : 0);
  const chartH = height - top - bottom;
  const up = pct >= 0;
  return (
    <div
      style={{
        width,
        height,
        background: "#0f0f0f",
        borderRadius: 14,
        overflow: "hidden",
        position: "relative",
        fontFamily,
        color: C.text,
        boxShadow: "0 40px 120px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06)",
      }}
    >
      {/* top bar */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: top, display: "flex", alignItems: "center", gap: 14, padding: "0 16px", borderBottom: "4px solid #050505", background: "#0f0f0f" }}>
        <div style={{ display: "flex", gap: 7 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c, opacity: 0.85 }} />
          ))}
        </div>
        <div style={{ marginLeft: 10, fontWeight: 700, fontSize: 15, padding: "5px 10px", borderRadius: 6, background: "rgba(255,255,255,.06)" }}>{symbol}</div>
        <span style={{ fontSize: 14, color: C.muted, fontWeight: 600 }}>1D</span>
        <span style={{ fontSize: 14, color: C.muted }}>Indicators</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{price}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: up ? C.up : C.down }}>
          {up ? "+" : "−"}
          {fmt(Math.abs(pct), 2)}%
        </span>
      </div>
      {/* left toolbar */}
      <div style={{ position: "absolute", left: 0, top: top, bottom: 0, width: left, borderRight: "4px solid #050505", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, paddingTop: 18 }}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} style={{ width: 18, height: 2, background: C.faint, borderRadius: 2, boxShadow: `0 5px 0 ${C.faint}` }} />
        ))}
      </div>
      {/* chart */}
      <div style={{ position: "absolute", left: left, top: top, width: chartW, height: chartH, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 18, top: 14, fontSize: 15, color: C.muted, fontWeight: 600, zIndex: 1 }}>
          <span style={{ color: C.text, fontWeight: 700 }}>{symbol}</span> · 1D · NSE
        </div>
        <Chart seed={symbol} width={chartW - 60} height={chartH} />
      </div>
      {/* the dock, between the chart and TradingView's right toolbar */}
      {dockWidth > 0 ? (
        <div style={{ position: "absolute", right: right + 4, top: top, width: dockWidth, height: chartH + bottom, overflow: "hidden" }}>{dock}</div>
      ) : null}
      {/* right toolbar */}
      <div style={{ position: "absolute", right: 0, top: top, bottom: 0, width: right, borderLeft: "4px solid #050505", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: btnActive ? "rgba(41,98,255,.16)" : "transparent" }}>
          <LogoMark size={28} color={btnActive ? C.blue : C.muted} />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${C.faint}` }} />
        ))}
      </div>
      {overlay}
    </div>
  );
};

/* ---------- the minimized pill ---------- */
export const Pill: React.FC<{ t: string; n: number; total: number; s: number; style?: React.CSSProperties }> = ({ t, n, total, s, style }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 2 * s,
      padding: 3 * s,
      borderRadius: 10 * s,
      background: "rgba(24,24,24,.92)",
      color: "#e6e6e6",
      boxShadow: `0 ${6 * s}px ${18 * s}px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.07)`,
      fontFamily,
      ...style,
    }}
  >
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 * s, padding: `${3 * s}px ${7 * s}px` }}>
      <span style={{ fontSize: 13 * s, fontWeight: 700, letterSpacing: ".02em" }}>{t}</span>
      <span style={{ fontSize: 11 * s, fontVariantNumeric: "tabular-nums", color: "#a8a8ad" }}>
        {n}/{total}
      </span>
    </div>
    {(["up", "down"] as const).map((d) => (
      <div key={d} style={{ width: 20 * s, height: 20 * s, display: "flex", alignItems: "center", justifyContent: "center", color: "#8c8c8c" }}>
        <Icon d={d} size={12 * s} width={2.4} />
      </div>
    ))}
  </div>
);

/* ---------- pointer and keys ---------- */
export const Cursor: React.FC<{ x: number; y: number; press?: number; size?: number }> = ({ x, y, press = 0, size = 34 }) => (
  <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none", zIndex: 50 }}>
    {press > 0 ? (
      <div
        style={{
          position: "absolute",
          left: -size * press,
          top: -size * press,
          width: size * 2 * press,
          height: size * 2 * press,
          borderRadius: "50%",
          border: `3px solid rgba(255,255,255,${0.5 * (1 - press)})`,
        }}
      />
    ) : null}
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,.5))", scale: press > 0 && press < 0.4 ? "0.9" : "1" }}>
      <path d="M4 2l15 10.5-6.5 1.3 3.8 7.4-3 1.5-3.8-7.5L4 20z" fill="#fff" stroke="#111" strokeWidth={1.3} strokeLinejoin="round" />
    </svg>
  </div>
);

export const Keycap: React.FC<{ label: React.ReactNode; down: boolean; size?: number }> = ({ label, down, size = 120 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.2,
      background: down ? "#1f2a44" : "#1a1a1c",
      border: `2px solid ${down ? C.blue : "rgba(255,255,255,.12)"}`,
      boxShadow: down ? `0 2px 0 #0b1530, 0 0 40px rgba(41,98,255,.35)` : "0 8px 0 #0c0c0d",
      translate: down ? "0px 6px" : "0px 0px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: down ? "#9db8ff" : C.text,
      fontFamily,
      fontWeight: 700,
      fontSize: size * 0.42,
    }}
  >
    {label}
  </div>
);
