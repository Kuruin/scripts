import React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Easing, Interactive, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE_IN_OUT, ease, fmt, fontFamily, LIST, type Sym } from "./theme";
import { Avatar, Badge, Chart, Cursor, Dock, Icon, Keycap, LogoMark, Pill, Row, SectionRow, TVWindow } from "./ui";
import { Backdrop, Caption, Toast } from "./parts";

const CLICK = "https://remotion.media/mouse-click.wav";
const SWITCH = "https://remotion.media/switch.wav";
const WHOOSH = "https://remotion.media/whoosh.wav";

// 0..1 progress of a click ripple that starts at `at`.
const press = (frame: number, at: number) => (frame < at || frame > at + 14 ? 0 : (frame - at) / 14);

/* 1 ---------- Title ---------- */
export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Backdrop glow="rgba(41,98,255,.22)">
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 36 }}>
        <Interactive.Div
          name="Logo tile"
          style={{
            width: 168,
            height: 168,
            borderRadius: 40,
            background: "linear-gradient(145deg, #2f6bff, #1a3fc4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 30px 80px rgba(41,98,255,.45), inset 0 1px 0 rgba(255,255,255,.25)",
            scale: interpolate(frame, [0, 0.9 * fps], [0.6, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1), output: "perceptual-scale" }),
            opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          <LogoMark size={128} />
        </Interactive.Div>
        <Interactive.Div
          name="Product name"
          style={{
            fontSize: 150,
            fontWeight: 800,
            letterSpacing: "-0.045em",
            opacity: interpolate(frame, [0.35 * fps, 0.9 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            translate: interpolate(frame, [0.35 * fps, 1.2 * fps], ["0px 40px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
          }}
        >
          Dockside
        </Interactive.Div>
        <Interactive.Div
          name="Tagline"
          style={{
            fontSize: 48,
            fontWeight: 500,
            color: C.muted,
            opacity: interpolate(frame, [0.8 * fps, 1.4 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            translate: interpolate(frame, [0.8 * fps, 1.7 * fps], ["0px 30px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
          }}
        >
          A fast, roomy watchlist that lives inside TradingView.
        </Interactive.Div>
      </AbsoluteFill>
    </Backdrop>
  );
};

/* 2 ---------- 1,000 symbols ---------- */
export const ThousandScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.round(ease(frame, [6, 1.6 * fps], [0, 1000], EASE_IN_OUT));
  return (
    <Backdrop>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 10 }}>
        <div style={{ fontSize: 300, fontWeight: 800, letterSpacing: "-0.05em", fontVariantNumeric: "tabular-nums", lineHeight: 1.05, padding: "0 40px", background: "linear-gradient(180deg,#fff,#9db8ff)", WebkitBackgroundClip: "text", color: "transparent" }}>
          {fmt(n, 0)}
        </div>
        <Interactive.Div
          name="Symbols line"
          style={{
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            opacity: interpolate(frame, [0.6 * fps, 1.1 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          symbols per list.
        </Interactive.Div>
        <Interactive.Div
          name="Lists line"
          style={{
            fontSize: 42,
            fontWeight: 500,
            color: C.muted,
            opacity: interpolate(frame, [1.1 * fps, 1.6 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          As many lists as you like. No subscription.
        </Interactive.Div>
      </AbsoluteFill>
    </Backdrop>
  );
};

/* 3 ---------- Docked inside TradingView ---------- */
const DockRows: React.FC<{ s: number; current?: number; rows?: Sym[]; states?: Record<string, { price?: number; pct?: number; flash?: "up" | "down" | null }> }> = ({ s, current = 1, rows = LIST, states }) => (
  <>
    <SectionRow name="Watching" count={rows.length} s={s} />
    {rows.map((r, i) => (
      <Row key={r.t} sym={r} s={s} current={i === current} state={states?.[r.t]} />
    ))}
  </>
);

export const DockedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dockW = ease(frame, [0.9 * fps, 1.6 * fps], [0, 300]);
  const zoom = ease(frame, [3 * fps, 4.8 * fps], [1, 1.6], EASE_IN_OUT);
  return (
    <Backdrop>
      <Caption eyebrow="Built in" title="Docked right inside TradingView." style={{ left: 140, top: 70 }} />
      <AbsoluteFill style={{ top: 250 }}>
        <div style={{ position: "absolute", left: 160, width: 1600, height: 780, transformOrigin: "1420px 340px", scale: String(zoom) }}>
          <TVWindow
            width={1600}
            height={780}
            symbol="SSWL"
            price="518.50"
            pct={1.16}
            dockWidth={dockW}
            btnActive={frame > 0.75 * fps}
            dock={
              <Dock s={1} width={300} height={734}>
                <DockRows s={1} />
              </Dock>
            }
            overlay={frame < 1.2 * fps ? <Cursor x={ease(frame, [0, 0.7 * fps], [1200, 1570])} y={ease(frame, [0, 0.7 * fps], [520, 76])} press={press(frame, 0.72 * fps)} /> : null}
          />
        </div>
      </AbsoluteFill>
      <Sequence from={0.72 * fps} durationInFrames={fps} layout="none">
        <Audio src={CLICK} volume={0.5} />
      </Sequence>
    </Backdrop>
  );
};

/* 4 ---------- Click to switch ---------- */
export const ClickScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = 1.9;
  const rows = LIST.slice(0, 8);
  const clicks = [
    { at: 1.4 * fps, i: 3 },
    { at: 3.2 * fps, i: 5 },
  ];
  const current = frame >= clicks[1].at ? clicks[1].i : frame >= clicks[0].at ? clicks[0].i : 1;
  const sym = rows[current];
  const rowY = (i: number) => 120 + 42 * s + 4 * s + 30 * s + i * 40 * s + 20 * s;
  const target = frame < clicks[0].at ? clicks[0] : clicks[1];
  const prev = frame < clicks[0].at ? { i: 1 } : clicks[0];
  const from = frame < clicks[0].at ? 0.5 * fps : clicks[0].at + 0.3 * fps;
  const cy = ease(frame, [from, target.at - 4], [rowY(prev.i), rowY(target.i)], EASE_IN_OUT);
  return (
    <Backdrop>
      <Caption
        eyebrow="One click"
        title={<>One click.<br />Chart switched.</>}
        body="Switches TradingView's chart in place. No new tabs, no reloads."
        style={{ left: 120, top: 330, width: 700 }}
      />
      {/* the chart that follows the dock */}
      <div style={{ position: "absolute", left: 860, top: 120, width: 370, height: 840, background: "#0f0f0f", borderRadius: 14, overflow: "hidden", boxShadow: "0 30px 90px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.06)" }}>
        <div style={{ padding: "26px 28px 0", display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 22, color: C.muted, fontWeight: 600 }}>NSE · 1D</span>
          <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.02em" }}>{sym.t}</span>
          <span style={{ fontSize: 30, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: sym.pct >= 0 ? C.up : C.down }}>
            {fmt(sym.p)} {sym.pct >= 0 ? "+" : "−"}
            {fmt(Math.abs(sym.pct))}%
          </span>
        </div>
        <div style={{ position: "absolute", bottom: 20, left: 0 }}>
          <Chart seed={sym.t} width={370} height={560} candles={32} />
        </div>
      </div>
      <Dock s={s} width={560} height={840} style={{ position: "absolute", left: 1250, top: 120, boxShadow: "0 30px 90px rgba(0,0,0,.5)" }}>
        <SectionRow name="Watching" count={rows.length} s={s} />
        {rows.map((r, i) => (
          <Row key={r.t} sym={r} s={s} current={i === current} hover={Math.abs(rowY(i) - cy) < 40 * s * 0.5} />
        ))}
      </Dock>
      <Cursor x={1470} y={cy} press={Math.max(press(frame, clicks[0].at), press(frame, clicks[1].at))} size={40} />
      {clicks.map((c) => (
        <Sequence key={c.at} from={c.at} durationInFrames={fps} layout="none">
          <Audio src={CLICK} volume={0.5} />
        </Sequence>
      ))}
    </Backdrop>
  );
};

/* 5 ---------- Search ---------- */
const RESULTS = [
  { t: "TATASTEEL", ex: "NSE", d: "Tata Steel Ltd" },
  { t: "TATAPOWER", ex: "NSE", d: "Tata Power Company Ltd" },
  { t: "TATACONSUM", ex: "NSE", d: "Tata Consumer Products Ltd" },
  { t: "TATAELXSI", ex: "NSE", d: "Tata Elxsi Ltd" },
  { t: "TATACOMM", ex: "NSE", d: "Tata Communications Ltd" },
  { t: "TATASTEEL", ex: "BSE", d: "Tata Steel Ltd" },
];
const TABS = ["All", "Stocks", "Funds", "Futures", "Forex", "Crypto", "Indices"];

export const SearchScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = 1.55;
  const typed = "TATA".slice(0, Math.max(0, Math.min(4, Math.floor((frame - 12) / 5))));
  const tabX = ease(frame, [2.2 * fps, 2.7 * fps], [0, 1]);
  const addAt = 3.9 * fps;
  const added = frame >= addAt;
  const toastIn = ease(frame, [addAt + 4, addAt + 16], [0, 1]);
  const W = 900;
  return (
    <Backdrop>
      <Caption
        eyebrow="Search"
        title={<>Find anything,<br />add it in one tap.</>}
        body="TradingView-style search with exchange badges and category filters."
        style={{ left: 140, top: 330, width: 640 }}
      />
      <div style={{ position: "absolute", left: 860, top: 130, width: W, background: C.pop, borderRadius: 14, border: `1px solid ${C.line}`, overflow: "hidden", boxShadow: "0 30px 90px rgba(0,0,0,.5)" }}>
        <div style={{ height: 46 * s, display: "flex", alignItems: "center", gap: 10 * s, padding: `0 ${14 * s}px`, borderBottom: `1px solid ${C.line}` }}>
          <Icon d="search" size={16 * s} color={C.muted} />
          <span style={{ fontSize: 16 * s, fontWeight: 600 }}>
            {typed}
            <span style={{ opacity: frame % 30 < 15 ? 1 : 0, color: C.blue }}>|</span>
          </span>
        </div>
        {/* category slider */}
        <div style={{ position: "relative", display: "flex", gap: 6 * s, padding: `${10 * s}px ${14 * s}px` }}>
          <div
            style={{
              position: "absolute",
              top: 10 * s,
              left: 14 * s + tabX * (48 * s + 6 * s),
              width: interpolate(tabX, [0, 1], [38 * s, 62 * s]),
              height: 26 * s,
              borderRadius: 13 * s,
              background: "#e8e8ea",
            }}
          />
          {TABS.map((t, i) => (
            <span
              key={t}
              style={{
                position: "relative",
                height: 26 * s,
                padding: `0 ${10 * s}px`,
                display: "flex",
                alignItems: "center",
                fontSize: 12.5 * s,
                fontWeight: 600,
                width: i === 0 ? 38 * s : i === 1 ? 62 * s : undefined,
                justifyContent: "center",
                color: (i === 0 && tabX < 0.5) || (i === 1 && tabX >= 0.5) ? "#111" : C.muted,
              }}
            >
              {t}
            </span>
          ))}
        </div>
        {RESULTS.map((r, i) => {
          const show = ease(frame, [1.2 * fps + i * 3, 1.2 * fps + i * 3 + 10], [0, 1]);
          const isAdd = i === 1;
          return (
            <div
              key={r.t + r.ex}
              style={{
                height: 54 * s,
                display: "flex",
                alignItems: "center",
                gap: 12 * s,
                padding: `0 ${14 * s}px`,
                opacity: show,
                translate: `0px ${(1 - show) * 16}px`,
                background: isAdd && frame > 3.2 * fps ? "rgba(255,255,255,.05)" : "transparent",
              }}
            >
              <Avatar t={r.t} s={s * 1.2} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 * s, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 * s }}>
                  <span style={{ fontSize: 14 * s, fontWeight: 700 }}>
                    <span style={{ color: "#7aa2ff" }}>TATA</span>
                    {r.t.slice(4)}
                  </span>
                  <Badge ex={r.ex} s={s} />
                </div>
                <span style={{ fontSize: 12 * s, color: C.muted }}>{r.d}</span>
              </div>
              <span style={{ fontSize: 11.5 * s, color: C.muted }}>stock</span>
              <div
                style={{
                  width: 28 * s,
                  height: 28 * s,
                  borderRadius: 7 * s,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: isAdd && added ? C.up : C.muted,
                  background: isAdd && added ? "rgba(34,171,148,.14)" : "transparent",
                }}
              >
                <Icon d={isAdd && added ? "check" : "plus"} size={16 * s} />
              </div>
            </div>
          );
        })}
      </div>
      <Cursor
        x={ease(frame, [2.9 * fps, addAt - 4], [1500, 1700], EASE_IN_OUT) + ease(frame, [addAt + 10, addAt + 30], [0, 60])}
        y={ease(frame, [2.9 * fps, addAt - 4], [860, 130 + 46 * s + 46 * s + 54 * s * 1.5]) + ease(frame, [addAt + 10, addAt + 30], [0, 90])}
        press={press(frame, addAt)}
        size={40}
      />
      <Toast kind="success" title="Added TATAPOWER" body="to CB" s={1.7} style={{ position: "absolute", left: 1200, top: 900, opacity: toastIn, translate: `0px ${(1 - toastIn) * 30}px` }} />
      <Sequence from={addAt} durationInFrames={fps} layout="none">
        <Audio src={CLICK} volume={0.5} />
      </Sequence>
    </Backdrop>
  );
};

/* 6 ---------- Lists and tags ---------- */
const LISTS = [
  { name: "CB", color: C.down, n: "39" },
  { name: "Swing", color: C.orange, n: "12" },
  { name: "Long term", color: C.green, n: "248" },
  { name: "Momentum 1000", color: C.blue, n: "1,000" },
];
export const ListsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = 2;
  const open = ease(frame, [0.5 * fps, 0.9 * fps], [0, 1]);
  const sel = frame > 2.6 * fps ? 2 : 0;
  const hoverI = Math.min(3, Math.max(0, Math.floor(ease(frame, [1.3 * fps, 2.5 * fps], [0, 2.99]))));
  return (
    <Backdrop>
      <Caption
        eyebrow="Organise"
        title={<>Lists and<br />colour tags.</>}
        body="Group symbols into sections. Tag them red, orange, green, blue or purple."
        style={{ left: 140, top: 330, width: 640 }}
      />
      <Dock s={s} width={600} height={840} listName={LISTS[sel].name} listColor={LISTS[sel].color} count={`${LISTS[sel].n} / 1,000`} style={{ position: "absolute", left: 1060, top: 120 }}>
        <div style={{ opacity: 0.12 }}>
          <DockRows s={s} rows={LIST.slice(0, 8)} />
        </div>
      </Dock>
      <div
        style={{
          position: "absolute",
          left: 1072,
          top: 120 + 42 * s,
          width: 250 * s,
          background: C.pop,
          border: `1px solid ${C.line}`,
          borderRadius: 8 * s,
          padding: 4 * s,
          boxShadow: "0 30px 80px rgba(0,0,0,.6)",
          opacity: open,
          scale: String(0.96 + open * 0.04),
          transformOrigin: "top left",
        }}
      >
        <div style={{ fontSize: 10.5 * s, fontWeight: 600, color: C.faint, padding: `${6 * s}px ${8 * s}px ${3 * s}px` }}>Watchlists</div>
        {LISTS.map((l, i) => (
          <div
            key={l.name}
            style={{
              height: 32 * s,
              display: "flex",
              alignItems: "center",
              gap: 9 * s,
              padding: `0 ${8 * s}px`,
              borderRadius: 5 * s,
              background: i === sel ? C.selected : i === hoverI && frame < 2.6 * fps ? "rgba(255,255,255,.04)" : "transparent",
            }}
          >
            <div style={{ width: 9 * s, height: 9 * s, borderRadius: "50%", background: l.color }} />
            <span style={{ flex: 1, fontSize: 13 * s, fontWeight: i === sel ? 700 : 500 }}>{l.name}</span>
            <span style={{ fontSize: 11.5 * s, color: C.muted, fontVariantNumeric: "tabular-nums" }}>{l.n}</span>
          </div>
        ))}
        <div style={{ height: 32 * s, display: "flex", alignItems: "center", gap: 9 * s, padding: `0 ${8 * s}px`, color: C.muted, fontSize: 13 * s }}>
          <Icon d="plus" size={13 * s} /> Create new list
        </div>
        <div style={{ height: 1, background: C.line, margin: `${4 * s}px 0` }} />
        <div style={{ fontSize: 10.5 * s, fontWeight: 600, color: C.faint, padding: `${6 * s}px ${8 * s}px ${3 * s}px` }}>Tags</div>
        <div style={{ display: "flex", gap: 6 * s, padding: `${4 * s}px ${8 * s}px ${8 * s}px` }}>
          {[C.down, C.blue, C.green, C.orange, C.purple].map((c, i) => (
            <div
              key={c}
              style={{
                width: 36 * s,
                height: 30 * s,
                borderRadius: 6 * s,
                background: "rgba(255,255,255,.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: ease(frame, [1 * fps + i * 3, 1 * fps + i * 3 + 8], [0, 1]),
              }}
            >
              <Icon d="bookmark" size={15 * s} color={c} fill={c} />
            </div>
          ))}
        </div>
      </div>
      <Sequence from={2.6 * fps} durationInFrames={fps} layout="none">
        <Audio src={CLICK} volume={0.5} />
      </Sequence>
    </Backdrop>
  );
};

/* 7 ---------- Live prices ---------- */
export const PricesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = 2;
  const rows = LIST.slice(0, 8);
  // Two refreshes: prices move and flash for a moment.
  const tick = frame >= 3 * fps ? 2 : frame >= 1.5 * fps ? 1 : 0;
  const moves = [0, 0.0018, -0.0012, 0.0024, -0.0009, 0.0031, -0.002, 0.0015];
  const states: Record<string, { price?: number; pct?: number; flash?: "up" | "down" | null }> = {};
  rows.forEach((r, i) => {
    const m = moves[i] * tick * (i % 3 === 0 ? -1 : 1);
    const since = frame - (tick === 2 ? 3 * fps : 1.5 * fps);
    states[r.t] = { price: r.p * (1 + m), pct: r.pct + m * 100, flash: tick > 0 && since < 8 && m !== 0 ? (m > 0 ? "up" : "down") : null };
  });
  const seg = ["5s", "15s", "1m", "Off"];
  return (
    <Backdrop>
      <Caption
        eyebrow="Live prices"
        title={<>Prices that<br />keep up.</>}
        body="Refresh every 5s, 15s or 1m, or sync by hand. Uses your TradingView login."
        style={{ left: 140, top: 330, width: 640 }}
      />
      <Dock
        s={s}
        width={600}
        height={840}
        style={{ position: "absolute", left: 1060, top: 120 }}
        footer={
          <>
            <div style={{ width: 6 * s, height: 6 * s, borderRadius: "50%", background: C.up, boxShadow: `0 0 ${8 * s}px ${C.up}` }} />
            <span style={{ color: C.text }}>Live</span>
            <span>· just now</span>
            <div style={{ flex: 1 }} />
            <div style={{ rotate: `${ease(frame, [3 * fps - 10, 3 * fps + 10], [0, 360])}deg`, display: "flex" }}>
              <Icon d="sync" size={13 * s} color={C.muted} />
            </div>
            <span style={{ marginLeft: 6 * s }}>39 / 1,000</span>
          </>
        }
      >
        <DockRows s={s} rows={rows} states={states} current={-1} />
      </Dock>
      <div
        style={{
          position: "absolute",
          left: 140,
          top: 760,
          padding: "22px 26px",
          borderRadius: 16,
          background: C.pop,
          border: `1px solid ${C.line}`,
          boxShadow: "0 30px 80px rgba(0,0,0,.6)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          opacity: ease(frame, [0.6 * fps, 1 * fps], [0, 1]),
          translate: `0px ${ease(frame, [0.6 * fps, 1.1 * fps], [24, 0])}px`,
        }}
      >
        <span style={{ fontSize: 24, color: C.muted, fontWeight: 600 }}>Price refresh</span>
        <div style={{ display: "flex", gap: 6, padding: 5, borderRadius: 12, background: C.panel2 }}>
          {seg.map((x) => (
            <span key={x} style={{ width: 84, height: 50, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, background: x === "15s" ? C.selected : "transparent", color: x === "15s" ? C.text : C.muted, boxShadow: x === "15s" ? "inset 0 0 0 1px rgba(255,255,255,.1)" : "none" }}>
              {x}
            </span>
          ))}
        </div>
      </div>
    </Backdrop>
  );
};

/* 8 ---------- Minimize and keyboard ---------- */
export const MinimizeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const minAt = 1.1 * fps;
  const dockW = ease(frame, [minAt, minAt + 12], [300, 0]);
  const pillIn = ease(frame, [minAt + 8, minAt + 22], [0, 1]);
  const keys = [
    { at: 2.6 * fps, dir: 1 },
    { at: 3.3 * fps, dir: 1 },
    { at: 4 * fps, dir: 1 },
    { at: 4.9 * fps, dir: -1 },
  ];
  let n = 2;
  for (const k of keys) if (frame >= k.at) n += k.dir;
  const sym = LIST[n - 1];
  const downKey = keys.find((k) => frame >= k.at && frame < k.at + 7);
  const keysIn = ease(frame, [2.1 * fps, 2.5 * fps], [0, 1]);
  return (
    <Backdrop>
      <Caption eyebrow="Minimize" title="Out of the way. Still in control." style={{ left: 140, top: 70 }} />
      <div style={{ position: "absolute", left: 240, top: 225, width: 1440, height: 640 }}>
        <TVWindow
          width={1440}
          height={640}
          symbol={sym.t}
          price={fmt(sym.p)}
          pct={sym.pct}
          dockWidth={dockW}
          btnActive
          dock={
            <Dock s={1} width={300} height={594}>
              <DockRows s={1} current={n - 1} />
            </Dock>
          }
          overlay={
            <>
              {frame < minAt + 10 ? <Cursor x={ease(frame, [0, minAt - 4], [1000, 1370])} y={ease(frame, [0, minAt - 4], [380, 66])} press={press(frame, minAt)} /> : null}
              <div style={{ position: "absolute", right: 120, bottom: 70, opacity: pillIn, scale: String(0.9 + pillIn * 0.1), transformOrigin: "bottom right" }}>
                <Pill t={sym.t} n={n} total={LIST.length} s={2} />
              </div>
            </>
          }
        />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 895, display: "flex", justifyContent: "center", alignItems: "center", gap: 22, opacity: keysIn, translate: `0px ${(1 - keysIn) * 30}px` }}>
        <Keycap label="↑" down={!!downKey && downKey.dir < 0} size={104} />
        <Keycap label="↓" down={!!downKey && downKey.dir > 0} size={104} />
        <span style={{ marginLeft: 26, fontSize: 40, fontWeight: 600, color: C.text }}>step through your list, not TradingView's.</span>
      </div>
      <Sequence from={minAt} durationInFrames={fps} layout="none">
        <Audio src={CLICK} volume={0.5} />
      </Sequence>
      {keys.map((k) => (
        <Sequence key={k.at} from={k.at} durationInFrames={fps} layout="none">
          <Audio src={SWITCH} volume={0.35} />
        </Sequence>
      ))}
    </Backdrop>
  );
};

/* 9 ---------- Paste hundreds ---------- */
export const PasteScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = 2;
  const pasteAt = 1.3 * fps;
  const clip = ease(frame, [0.3 * fps, 0.8 * fps], [0, 1]);
  const flyOut = ease(frame, [pasteAt, pasteAt + 10], [0, 1]);
  const count = Math.round(ease(frame, [pasteAt + 6, pasteAt + 1.2 * fps], [39, 284], EASE_IN_OUT));
  const t1 = ease(frame, [pasteAt + 1.3 * fps, pasteAt + 1.3 * fps + 12], [0, 1]);
  const t2 = ease(frame, [pasteAt + 1.9 * fps, pasteAt + 1.9 * fps + 12], [0, 1]);
  const NEW: Sym[] = [
    { t: "BEL", ex: "NSE", p: 412.35, pct: 2.14 },
    { t: "HAL", ex: "NSE", p: 4688.9, pct: 1.37 },
    { t: "IRFC", ex: "NSE", p: 128.4, pct: -0.62 },
    { t: "RVNL", ex: "NSE", p: 351.05, pct: 0.88 },
    { t: "COCHINSHIP", ex: "NSE", p: 1755.2, pct: -1.04 },
    { t: "MAZDOCK", ex: "NSE", p: 2810.6, pct: 0.47 },
  ];
  const rows = frame >= pasteAt + 6 ? [...NEW, ...LIST.slice(0, 2)] : LIST.slice(0, 8);
  return (
    <Backdrop>
      <Caption
        eyebrow="Bulk add"
        title={<>Paste hundreds<br />at once.</>}
        body="Paste a list or import TradingView's export. Tickers it doesn't list are caught and reported."
        style={{ left: 140, top: 330, width: 640 }}
      />
      <Dock s={s} width={600} height={840} count={`${count} / 1,000`} style={{ position: "absolute", left: 1060, top: 120 }}>
        <SectionRow name={frame >= pasteAt + 6 ? "Defence & rail" : "Watching"} count={rows.length} s={s} />
        {rows.map((r, i) => (
          <div key={r.t} style={{ opacity: frame >= pasteAt + 6 && i < 6 ? ease(frame, [pasteAt + 6 + i * 2, pasteAt + 14 + i * 2], [0, 1]) : 1 }}>
            <Row sym={r} s={s} />
          </div>
        ))}
      </Dock>
      {/* the clipboard */}
      <div
        style={{
          position: "absolute",
          left: 860,
          top: 160,
          width: 520,
          padding: "24px 28px",
          borderRadius: 16,
          background: "#1b1b1d",
          border: `1px solid ${C.line}`,
          boxShadow: "0 30px 80px rgba(0,0,0,.6)",
          fontFamily: "ui-monospace, Consolas, monospace",
          fontSize: 24,
          lineHeight: 1.55,
          color: "#c9c9cf",
          opacity: clip * (1 - flyOut),
          translate: `${flyOut * 220}px ${(1 - clip) * 30}px`,
          scale: String(1 - flyOut * 0.1),
        }}
      >
        <div style={{ fontFamily, fontSize: 22, color: C.muted, fontWeight: 600, marginBottom: 8 }}>Clipboard · 248 symbols</div>
        ###Defence &amp; rail,
        <br />
        NSE:BEL, NSE:HAL, NSE:IRFC,
        <br />
        NSE:RVNL, NSE:COCHINSHIP,
        <br />
        NSE:MAZDOCK, NSE:BDL …
      </div>
      <Toast kind="success" title="Added 245 symbols" body="to CB" s={1.7} style={{ position: "absolute", left: 1150, top: 720, opacity: t1, translate: `0px ${(1 - t1) * 30}px` }} />
      <Toast
        kind="error"
        title="3 symbols weren't added"
        body="TradingView doesn't list these. Check the tickers and exchanges."
        action="Copy 3 symbols"
        s={1.7}
        style={{ position: "absolute", left: 1150, top: 720 - 210 * t2, opacity: t2, zIndex: 2 }}
      />
      <Sequence from={pasteAt} durationInFrames={fps} layout="none">
        <Audio src={WHOOSH} volume={0.25} />
      </Sequence>
    </Backdrop>
  );
};

/* 10 ---------- Polite to TradingView ---------- */
const CARDS = [
  { k: "1", title: "One request at a time", body: "Prices load in batches, never a flood." },
  { k: "2", title: "Backs off on its own", body: "If TradingView says slow down, it pauses and resumes." },
  { k: "3", title: "Shared across tabs", body: "Open docks reuse each other's prices." },
];
export const SafeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Backdrop glow="rgba(34,171,148,.12)">
      <Caption eyebrow="Built to be polite" title="Light on TradingView." align="center" style={{ left: 0, right: 0, top: 150 }} />
      <div style={{ position: "absolute", left: 140, right: 140, top: 470, display: "flex", gap: 40 }}>
        {CARDS.map((c, i) => {
          const t = ease(frame, [0.6 * fps + i * 6, 0.6 * fps + i * 6 + 18], [0, 1]);
          return (
            <div
              key={c.k}
              style={{
                flex: 1,
                padding: "44px 40px",
                borderRadius: 24,
                background: "rgba(255,255,255,.035)",
                border: `1px solid ${C.line}`,
                display: "flex",
                flexDirection: "column",
                gap: 18,
                opacity: t,
                translate: `0px ${(1 - t) * 40}px`,
              }}
            >
              <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(34,171,148,.14)", color: C.up, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon d="check" size={34} width={3} />
              </div>
              <span style={{ fontSize: 46, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{c.title}</span>
              <span style={{ fontSize: 34, color: C.muted, lineHeight: 1.35 }}>{c.body}</span>
            </div>
          );
        })}
      </div>
    </Backdrop>
  );
};

/* 11 ---------- Installation ---------- */
const Step: React.FC<{ n: number; title: string; active: number; children: React.ReactNode; at: number }> = ({ n, title, active, children, at }) => {
  const frame = useCurrentFrame();
  const t = ease(frame, [at, at + 16], [0, 1]);
  const on = active === n;
  return (
    <div
      style={{
        flex: 1,
        borderRadius: 24,
        padding: "34px 30px",
        background: on ? "rgba(41,98,255,.09)" : "rgba(255,255,255,.03)",
        border: `2px solid ${on ? "rgba(41,98,255,.6)" : C.line}`,
        display: "flex",
        flexDirection: "column",
        gap: 24,
        opacity: t,
        translate: `0px ${(1 - t) * 40}px`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 54, height: 54, borderRadius: "50%", background: on ? C.blue : "rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800 }}>{n}</div>
      </div>
      <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.02em", minHeight: 92 }}>{title}</span>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>{children}</div>
    </div>
  );
};

export const InstallScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = [0.5, 2.3, 4.1, 5.9].map((x) => x * fps);
  const active = frame >= at[3] ? 4 : frame >= at[2] ? 3 : frame >= at[1] ? 2 : 1;
  const devOn = frame >= at[1] + 0.9 * fps;
  const loadPressed = frame >= at[2] + 0.8 * fps && frame < at[2] + 1 * fps;
  const altDown = frame >= at[3] + 0.8 * fps && frame < at[3] + 1.1 * fps;
  const mono: React.CSSProperties = { fontFamily: "ui-monospace, Consolas, monospace", fontSize: 25, color: "#c9c9cf" };
  return (
    <Backdrop>
      <Caption eyebrow="Install" title="Up and running in a minute." align="center" style={{ left: 0, right: 0, top: 90 }} />
      <div style={{ position: "absolute", left: 120, right: 120, top: 330, height: 500, display: "flex", gap: 28 }}>
        <Step n={1} title="Download the zip" active={active} at={at[0]}>
          <div style={{ padding: "18px 20px", borderRadius: 14, background: "#151517", border: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 22, color: C.muted, fontWeight: 600 }}>GitHub · Releases</span>
            <span style={{ ...mono, color: "#7aa2ff" }}>dockside-1.8.0.zip</span>
          </div>
        </Step>
        <Step n={2} title="Turn on Developer mode" active={active} at={at[1]}>
          <div style={{ padding: "18px 20px", borderRadius: 14, background: "#151517", border: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 16 }}>
            <span style={mono}>chrome://extensions</span>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 24, color: C.text, flex: 1 }}>Developer mode</span>
              <div style={{ width: 64, height: 36, borderRadius: 18, background: devOn ? C.blue : "#3a3a3e", position: "relative" }}>
                <div style={{ position: "absolute", top: 4, left: devOn ? 32 : 4, width: 28, height: 28, borderRadius: "50%", background: "#fff" }} />
              </div>
            </div>
          </div>
        </Step>
        <Step n={3} title="Load unpacked" active={active} at={at[2]}>
          <div style={{ padding: "18px 20px", borderRadius: 14, background: "#151517", border: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 16 }}>
            <span style={{ alignSelf: "flex-start", fontSize: 24, fontWeight: 700, padding: "10px 18px", borderRadius: 10, border: `2px solid ${C.blue}`, color: "#9db8ff", scale: loadPressed ? "0.95" : "1" }}>Load unpacked</span>
            <span style={{ ...mono, fontSize: 22 }}>…/dockside-1.8.0</span>
          </div>
        </Step>
        <Step n={4} title="Open a chart, press Alt+W" active={active} at={at[3]}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Keycap label="Alt" down={altDown} size={104} />
            <span style={{ fontSize: 44, color: C.muted, fontWeight: 700 }}>+</span>
            <Keycap label="W" down={altDown} size={104} />
          </div>
        </Step>
      </div>
      <Interactive.Div
        name="Browsers"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 900,
          textAlign: "center",
          fontSize: 34,
          color: C.muted,
          opacity: interpolate(frame, [6.6 * fps, 7.2 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        Works in Chrome and Brave. In Brave, open brave://extensions.
      </Interactive.Div>
      {[at[1] + 0.9 * fps, at[2] + 0.8 * fps].map((f) => (
        <Sequence key={f} from={f} durationInFrames={fps} layout="none">
          <Audio src={CLICK} volume={0.45} />
        </Sequence>
      ))}
      <Sequence from={at[3] + 0.8 * fps} durationInFrames={fps} layout="none">
        <Audio src={SWITCH} volume={0.35} />
      </Sequence>
    </Backdrop>
  );
};

/* 12 ---------- Outro ---------- */
export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Backdrop glow="rgba(41,98,255,.24)">
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 34, opacity: ease(frame, [0, 0.5 * fps], [0, 1]), scale: String(ease(frame, [0, 0.9 * fps], [0.92, 1])) }}>
          <div style={{ width: 128, height: 128, borderRadius: 32, background: "linear-gradient(145deg, #2f6bff, #1a3fc4)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 24px 70px rgba(41,98,255,.45)" }}>
            <LogoMark size={98} />
          </div>
          <span style={{ fontSize: 130, fontWeight: 800, letterSpacing: "-0.045em" }}>Dockside</span>
        </div>
        <Interactive.Div
          name="Outro line"
          style={{
            fontSize: 48,
            fontWeight: 500,
            color: C.muted,
            opacity: interpolate(frame, [0.5 * fps, 1 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          Free. Lives in TradingView. Built for big lists.
        </Interactive.Div>
        <Interactive.Div
          name="Call to action"
          style={{
            marginTop: 30,
            fontSize: 40,
            fontWeight: 700,
            padding: "24px 44px",
            borderRadius: 999,
            background: "#e8e8ea",
            color: "#0a0a0b",
            opacity: interpolate(frame, [0.9 * fps, 1.4 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            translate: interpolate(frame, [0.9 * fps, 1.6 * fps], ["0px 24px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
          }}
        >
          Download it from GitHub Releases
        </Interactive.Div>
      </AbsoluteFill>
    </Backdrop>
  );
};

export { fontFamily };
