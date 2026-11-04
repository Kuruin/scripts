import React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Easing, Interactive, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CountGrid } from "../components/snap-cn/count-grid";
import { CursorTrack } from "../components/snap-cn/cursor-track";
import { TextHighlight } from "../components/snap-cn/text-highlight";
import { TextReveal } from "../components/snap-cn/text-reveal";
import { ease, EASE_IN_OUT, fmt, fontFamily, LIST } from "../theme";
import { Icon, LogoMark } from "../ui";
import { BRAND, L, LChart, LDock, LKey, LPill, LRow, LWindow } from "./ui";

const CLICK = "https://remotion.media/mouse-click.wav";
const SWITCH = "https://remotion.media/switch.wav";

// One short sentence-case line above the product, like the references.
const Headline: React.FC<{ children: React.ReactNode; top?: number }> = ({ children, top = 52 }) => {
  const frame = useCurrentFrame();
  return (
    <Interactive.Div
      name="Headline"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top,
        textAlign: "center",
        fontFamily,
        fontSize: 40,
        fontWeight: 600,
        color: BRAND.ink,
        opacity: interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        translate: interpolate(frame, [0, 20], ["0px 14px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
      }}
    >
      {children}
    </Interactive.Div>
  );
};

/* 1 ---------- Hook ---------- */
export const HookScene: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
    <TextHighlight before="Watch " highlight="1,000 stocks" after=" without leaving the chart." preset="marker" fontSize={44} startAt={14} drawDuration={16} />
  </AbsoluteFill>
);

/* 2 ---------- Positioning ---------- */
export const MeetScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: 250, fontFamily, fontSize: 22, color: L.text2, opacity: ease(frame, [0, 10], [0, 1]) }}>Introducing</div>
      <TextReveal text="Meet Dockside" fontSize={84} fontWeight={700} />
    </AbsoluteFill>
  );
};

/* 3 ---------- Docked inside TradingView ---------- */
export const DockedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clickAt = 30;
  const dockW = ease(frame, [clickAt + 2, clickAt + 22], [0, 240]);
  const push = ease(frame, [3.4 * fps, 5.2 * fps], [1, 1.45], EASE_IN_OUT);
  return (
    <AbsoluteFill>
      <Headline>It lives inside TradingView.</Headline>
      <CursorTrack
        path={[
          { at: 0, x: 0.62, y: 0.7, duration: 6 },
          { at: 8, x: 0.9, y: 0.226, duration: 20, click: true },
          { at: 50, x: 1.08, y: 0.5, duration: 16 },
        ]}
      >
        <div style={{ position: "absolute", left: 100, top: 130, width: 1080, height: 540, transformOrigin: "940px 250px", scale: String(push) }}>
          <LWindow
            width={1080}
            height={540}
            symbol="SSWL"
            price="518.50"
            pct={1.16}
            dockWidth={dockW}
            btnActive={frame >= clickAt + 2}
            dock={
              <LDock s={1} width={240} height={493}>
                {LIST.slice(0, 9).map((r, i) => (
                  <LRow key={r.t} sym={r} s={0.86} current={i === 1} />
                ))}
              </LDock>
            }
          />
        </div>
      </CursorTrack>
      <Sequence from={clickAt - 2} durationInFrames={fps} layout="none">
        <Audio src={CLICK} volume={0.45} />
      </Sequence>
    </AbsoluteFill>
  );
};

/* 4 ---------- One click ---------- */
export const ClickScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = 1.32;
  const rows = LIST.slice(0, 8);
  const c1 = 46;
  const c2 = 100;
  const current = frame >= c2 ? 5 : frame >= c1 ? 3 : 1;
  const sym = rows[current];
  const dockTop = 130;
  // Row centre in frame coordinates, for the cursor waypoints.
  const rowY = (i: number) => (dockTop + 42 * s + 4 * s + 30 * s + i * 40 * s + 20 * s) / 720;
  return (
    <AbsoluteFill>
      <Headline>One click. The chart follows.</Headline>
      <CursorTrack
        path={[
          { at: 0, x: 0.92, y: 0.95, duration: 6 },
          { at: 22, x: 0.62, y: rowY(3), duration: 22, click: true },
          { at: 74, x: 0.62, y: rowY(5), duration: 24, click: true },
          { at: 128, x: 0.95, y: 0.92, duration: 16 },
        ]}
      >
        <div style={{ position: "absolute", left: 210, top: dockTop, width: 420, height: 540, background: L.bg, border: `1px solid ${L.border}`, borderRadius: 12, overflow: "hidden", boxShadow: L.shadow, fontFamily, color: L.text }}>
          <div style={{ padding: "20px 22px 0", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 15, color: L.text2, fontWeight: 600 }}>NSE · 1D</span>
            <span style={{ fontSize: 34, fontWeight: 800 }}>{sym.t}</span>
            <span style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: sym.pct >= 0 ? L.up : L.down }}>
              {fmt(sym.p)} {sym.pct >= 0 ? "+" : "−"}
              {fmt(Math.abs(sym.pct))}%
            </span>
          </div>
          <div style={{ position: "absolute", left: 0, bottom: 14 }}>
            <LChart seed={sym.t} width={420} height={380} candles={30} />
          </div>
        </div>
        <LDock s={s} width={420} height={540} style={{ position: "absolute", left: 650, top: dockTop, boxShadow: L.shadow }}>
          {rows.map((r, i) => (
            <LRow key={r.t} sym={r} s={s} current={i === current} />
          ))}
        </LDock>
      </CursorTrack>
      {[c1, c2].map((f) => (
        <Sequence key={f} from={f} durationInFrames={fps} layout="none">
          <Audio src={CLICK} volume={0.45} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/* 5 ---------- Minimize, then ↑ ↓ ---------- */
export const MinimizeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const minAt = 34;
  const dockW = ease(frame, [minAt, minAt + 12], [240, 0]);
  const pillIn = ease(frame, [minAt + 8, minAt + 22], [0, 1]);
  const keys = [
    { at: 80, dir: 1 },
    { at: 100, dir: 1 },
    { at: 120, dir: 1 },
    { at: 146, dir: -1 },
  ];
  let n = 2;
  for (const k of keys) if (frame >= k.at) n += k.dir;
  const sym = LIST[n - 1];
  const pressed = keys.find((k) => frame >= k.at && frame < k.at + 6);
  const keysIn = ease(frame, [62, 76], [0, 1]);
  return (
    <AbsoluteFill>
      <Headline>Minimize it. Your keys still work.</Headline>
      <CursorTrack
        path={[
          { at: 0, x: 0.7, y: 0.62, duration: 6 },
          { at: 8, x: 0.851, y: 0.235, duration: 22, click: true },
          { at: 46, x: 1.08, y: 0.4, duration: 14 },
        ]}
      >
        <div style={{ position: "absolute", left: 140, top: 128, width: 1000, height: 470 }}>
          <LWindow
            width={1000}
            height={470}
            symbol={sym.t}
            price={fmt(sym.p)}
            pct={sym.pct}
            dockWidth={dockW}
            btnActive
            dock={
              <LDock s={1} width={240} height={423}>
                {LIST.slice(0, 8).map((r, i) => (
                  <LRow key={r.t} sym={r} s={0.86} current={i === n - 1} />
                ))}
              </LDock>
            }
          >
            <div style={{ position: "absolute", right: 80, bottom: 40, opacity: pillIn, scale: String(0.92 + pillIn * 0.08), transformOrigin: "bottom right" }}>
              <LPill t={sym.t} n={n} total={LIST.length} s={1.5} />
            </div>
          </LWindow>
        </div>
      </CursorTrack>
      <div style={{ position: "absolute", left: 0, right: 0, top: 622, display: "flex", justifyContent: "center", alignItems: "center", gap: 12, opacity: keysIn, fontFamily }}>
        <LKey label="↑" down={!!pressed && pressed.dir < 0} />
        <LKey label="↓" down={!!pressed && pressed.dir > 0} />
        <span style={{ marginLeft: 14, fontSize: 24, fontWeight: 500, color: L.text2 }}>step through your list, not TradingView&apos;s</span>
      </div>
      <Sequence from={minAt - 2} durationInFrames={fps} layout="none">
        <Audio src={CLICK} volume={0.45} />
      </Sequence>
      {keys.map((k) => (
        <Sequence key={k.at} from={k.at} durationInFrames={fps} layout="none">
          <Audio src={SWITCH} volume={0.3} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/* 6 ---------- Scale: 1,000 per list ---------- */
const CARDS = ["NIFTY", "SSWL", "RELIANCE", "TCS", "HDFCBANK", "ASAL", "YASHO", "INFY", "LT", "SBIN"].map((t) => staticFile(`cards/${t}.png`));
export const ScaleScene: React.FC = () => <CountGrid from="39" to="1,000" noun="symbols in one list" cards={CARDS} background="transparent" />;

/* 7 ---------- Install ---------- */
const STEPS = [
  { title: "Download the zip", body: "From GitHub Releases", code: "dockside-1.8.0.zip" },
  { title: "Load it in Chrome", body: "Developer mode, Load unpacked", code: "chrome://extensions" },
  { title: "Open any chart", body: "Press Alt+W to open the dock", code: "Alt + W" },
];
export const InstallScene: React.FC = () => {
  const frame = useCurrentFrame();
  const active = frame >= 104 ? 2 : frame >= 62 ? 1 : 0;
  return (
    <AbsoluteFill>
      <Headline top={120}>Install in a minute.</Headline>
      <div style={{ position: "absolute", left: 110, right: 110, top: 250, display: "flex", gap: 22, fontFamily }}>
        {STEPS.map((st, i) => {
          const t = ease(frame, [14 + i * 5, 32 + i * 5], [0, 1]);
          const on = active === i;
          return (
            <div
              key={st.title}
              style={{
                flex: 1,
                height: 250,
                borderRadius: 16,
                padding: "26px 24px",
                boxSizing: "border-box",
                background: L.bg,
                border: `1px solid ${on ? BRAND.accent : L.border}`,
                boxShadow: on ? "0 0 0 3px rgba(11,127,134,.14)" : "0 1px 2px rgba(19,23,34,.06)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                opacity: t,
                translate: `0px ${(1 - t) * 18}px`,
              }}
            >
              <div style={{ flex: "0 0 auto", width: 34, height: 34, borderRadius: "50%", background: on ? BRAND.accent : L.bg2, color: on ? "#fff" : L.text2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700 }}>{i + 1}</div>
              <span style={{ fontSize: 26, fontWeight: 700, color: L.text, marginTop: 6 }}>{st.title}</span>
              <span style={{ fontSize: 18, color: L.text2 }}>{st.body}</span>
              <span style={{ marginTop: "auto", alignSelf: "flex-start", fontFamily: "ui-monospace, Consolas, monospace", fontSize: 16, color: on ? BRAND.accent : L.text2, background: on ? BRAND.accentSoft : L.bg2, padding: "6px 10px", borderRadius: 8 }}>{st.code}</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 556, textAlign: "center", fontFamily, fontSize: 20, color: L.text2, opacity: ease(frame, [120, 136], [0, 1]) }}>Works in Chrome and Brave.</div>
    </AbsoluteFill>
  );
};

/* 8 ---------- Star the repo ---------- */
export const StarScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clickAt = 58;
  const starred = frame >= clickAt;
  const pop = ease(frame, [clickAt, clickAt + 6], [0.8, 1]);
  const cardIn = ease(frame, [0, 18], [0, 1]);
  return (
    <AbsoluteFill>
      <Headline top={150}>Free and open source.</Headline>
      <CursorTrack
        path={[
          { at: 0, x: 0.5, y: 0.95, duration: 6 },
          { at: 26, x: 0.705, y: 0.512, duration: 26, click: true },
          { at: 64, x: 0.8, y: 0.72, duration: 16 },
        ]}
      >
        <div
          style={{
            position: "absolute",
            left: 290,
            top: 300,
            width: 700,
            height: 136,
            boxSizing: "border-box",
            background: L.bg,
            border: `1px solid ${L.border}`,
            borderRadius: 14,
            boxShadow: L.shadow,
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "0 26px",
            fontFamily,
            opacity: cardIn,
            translate: `0px ${(1 - cardIn) * 16}px`,
          }}
        >
          <svg width={44} height={44} viewBox="0 0 16 16" fill={L.text}>
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: L.text }}>
              Kuruin <span style={{ color: L.text3, fontWeight: 500 }}>/</span> scripts
            </span>
            <span style={{ fontSize: 17, color: L.text2 }}>tradingview/watchlist-extension</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 46,
              padding: "0 18px",
              borderRadius: 10,
              border: `1px solid ${starred ? BRAND.accent : L.border}`,
              background: starred ? BRAND.accentSoft : L.bg2,
              color: starred ? BRAND.accent : L.text,
              fontSize: 19,
              fontWeight: 700,
            }}
          >
            <div style={{ scale: String(starred ? pop : 1), display: "flex" }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill={starred ? BRAND.accent : "none"} stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
                <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
              </svg>
            </div>
            {starred ? "Starred" : "Star"}
          </div>
        </div>
      </CursorTrack>
      <div style={{ position: "absolute", left: 0, right: 0, top: 486, display: "flex", justifyContent: "center", opacity: ease(frame, [clickAt + 10, clickAt + 22], [0, 1]) }}>
        <TextHighlight before="If it saves you time, " highlight="star the repo" after="." preset="marker" fontSize={30} fontWeight={500} startAt={clickAt + 14} />
      </div>
      <Sequence from={clickAt} durationInFrames={fps} layout="none">
        <Audio src={CLICK} volume={0.45} />
      </Sequence>
    </AbsoluteFill>
  );
};

/* 9 ---------- Outro ---------- */
export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 22, fontFamily }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, opacity: ease(frame, [0, 14], [0, 1]), translate: `0px ${ease(frame, [0, 22], [12, 0])}px` }}>
        <div style={{ width: 76, height: 76, borderRadius: 18, background: BRAND.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LogoMark size={58} />
        </div>
        <span style={{ fontSize: 76, fontWeight: 700, color: BRAND.ink, letterSpacing: "-0.03em" }}>Dockside</span>
      </div>
      <span style={{ fontSize: 24, color: L.text2, opacity: ease(frame, [10, 24], [0, 1]) }}>A bigger watchlist for TradingView.</span>
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, opacity: ease(frame, [20, 34], [0, 1]) }}>
        <span style={{ fontSize: 19, fontWeight: 600, color: "#fff", background: BRAND.accent, padding: "11px 20px", borderRadius: 999 }}>Download on GitHub</span>
        <span style={{ fontSize: 19, color: L.text2, padding: "11px 6px" }}>github.com/Kuruin/scripts</span>
      </div>
      <div style={{ position: "absolute", bottom: 40, display: "flex", gap: 8, alignItems: "center", fontSize: 16, color: L.text3, opacity: ease(frame, [30, 44], [0, 1]) }}>
        <Icon d="check" size={16} color={L.text3} /> Free · Chrome and Brave
      </div>
    </AbsoluteFill>
  );
};
