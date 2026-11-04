import { loadFont } from "@remotion/google-fonts/Inter";
import { Easing, interpolate } from "remotion";

export const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

// The extension's own dark palette (styles.css) and TradingView's up/down colours.
export const C = {
  bg: "#0a0a0b",
  panel: "#121212",
  panel2: "#191919",
  pop: "#161616",
  selected: "#222222",
  line: "rgba(255,255,255,0.08)",
  text: "#e8e8ea",
  muted: "#8b8b90",
  faint: "#5c5c62",
  blue: "#2962ff",
  up: "#22ab94",
  down: "#f23645",
  orange: "#ff9800",
  purple: "#9c27b0",
  green: "#22ab94",
};

export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

// Clamped, eased interpolation for the mock UI's internals.
export const ease = (
  frame: number,
  input: [number, number],
  output: [number, number],
  easing = EASE,
) =>
  interpolate(frame, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

// Stable hue per ticker for letter avatars (same rule as the extension).
export const hueOf = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

export type Sym = {
  t: string;
  ex: string;
  p: number;
  pct: number;
  dec?: number;
  tag?: string;
};

export const fmt = (v: number, dec = 2) =>
  v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const LIST: Sym[] = [
  { t: "NIFTY", ex: "NSE", p: 23813.75, pct: 0.42 },
  { t: "SSWL", ex: "NSE", p: 518.5, pct: 1.16, tag: C.down },
  { t: "RELIANCE", ex: "NSE", p: 1412.6, pct: 0.84 },
  { t: "TCS", ex: "NSE", p: 3052.1, pct: -1.12, tag: C.blue },
  { t: "HDFCBANK", ex: "NSE", p: 1001.45, pct: 0.31 },
  { t: "ASAL", ex: "NSE", p: 449.35, pct: 1.66 },
  { t: "YASHO", ex: "NSE", p: 3329.1, pct: -1.8 },
  { t: "INFY", ex: "NSE", p: 1498.3, pct: -0.42 },
  { t: "LT", ex: "NSE", p: 3711.0, pct: 1.04, tag: C.green },
  { t: "SBIN", ex: "NSE", p: 872.15, pct: -0.65 },
];
