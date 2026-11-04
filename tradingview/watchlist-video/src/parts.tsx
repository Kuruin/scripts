import React from "react";
import { AbsoluteFill, Interactive, interpolate, Easing, useCurrentFrame } from "remotion";
import { C, fontFamily } from "./theme";
import { Icon } from "./ui";

// Background used by every scene: near-black with a soft blue glow.
export const Backdrop: React.FC<{ children: React.ReactNode; glow?: string }> = ({ children, glow = "rgba(41,98,255,.16)" }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(1200px 700px at 78% 38%, ${glow}, transparent 70%), radial-gradient(900px 600px at 10% 100%, rgba(34,171,148,.07), transparent 70%), ${C.bg}`,
      fontFamily,
      color: C.text,
    }}
  >
    {children}
  </AbsoluteFill>
);

// Eyebrow, headline and supporting line, entering one after another.
export const Caption: React.FC<{
  eyebrow: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  style?: React.CSSProperties;
  align?: "left" | "center";
}> = ({ eyebrow, title, body, style, align = "left" }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", display: "flex", flexDirection: "column", gap: 22, textAlign: align, alignItems: align === "center" ? "center" : "flex-start", ...style }}>
      <Interactive.Div
        name="Eyebrow"
        style={{
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: "0.14em",
          color: "#7aa2ff",
          opacity: interpolate(frame, [4, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          translate: interpolate(frame, [4, 22], ["0px 24px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
        }}
      >
        {eyebrow.toUpperCase()}
      </Interactive.Div>
      <Interactive.Div
        name="Headline"
        style={{
          fontSize: 84,
          fontWeight: 800,
          lineHeight: 1.04,
          letterSpacing: "-0.035em",
          opacity: interpolate(frame, [8, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          translate: interpolate(frame, [8, 30], ["0px 32px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
        }}
      >
        {title}
      </Interactive.Div>
      {body ? (
        <Interactive.Div
          name="Supporting line"
          style={{
            fontSize: 40,
            fontWeight: 500,
            lineHeight: 1.3,
            color: C.muted,
            maxWidth: 720,
            opacity: interpolate(frame, [16, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            translate: interpolate(frame, [16, 38], ["0px 28px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
          }}
        >
          {body}
        </Interactive.Div>
      ) : null}
    </div>
  );
};

// A Sonner-style toast, like the extension's.
export const Toast: React.FC<{
  kind: "success" | "error" | "info";
  title: string;
  body?: string;
  action?: string;
  s: number;
  style?: React.CSSProperties;
}> = ({ kind, title, body, action, s, style }) => {
  const color = kind === "success" ? C.up : kind === "error" ? C.down : C.blue;
  return (
    <div
      style={{
        width: 300 * s,
        background: "#1a1a1a",
        border: `1px solid ${C.line}`,
        borderRadius: 10 * s,
        padding: `${12 * s}px ${14 * s}px`,
        display: "flex",
        gap: 10 * s,
        boxShadow: `0 ${10 * s}px ${30 * s}px rgba(0,0,0,.5)`,
        fontFamily,
        ...style,
      }}
    >
      <div
        style={{
          width: 18 * s,
          height: 18 * s,
          borderRadius: "50%",
          background: color,
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          marginTop: 1 * s,
        }}
      >
        <Icon d={kind === "error" ? "x" : "check"} size={11 * s} width={3} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 * s, minWidth: 0 }}>
        <span style={{ fontSize: 13 * s, fontWeight: 700, color: C.text }}>{title}</span>
        {body ? <span style={{ fontSize: 11.5 * s, color: C.muted, lineHeight: 1.35 }}>{body}</span> : null}
        {action ? (
          <span
            style={{
              alignSelf: "flex-start",
              marginTop: 4 * s,
              display: "flex",
              alignItems: "center",
              gap: 6 * s,
              fontSize: 11.5 * s,
              fontWeight: 600,
              color: C.text,
              padding: `${5 * s}px ${9 * s}px`,
              borderRadius: 6 * s,
              background: "rgba(255,255,255,.07)",
            }}
          >
            <Icon d="copy" size={12 * s} />
            {action}
          </span>
        ) : null}
      </div>
    </div>
  );
};
