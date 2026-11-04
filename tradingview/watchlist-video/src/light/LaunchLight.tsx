import { springTiming, TransitionSeries } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, staticFile } from "remotion";
import { SnapCnUIProvider } from "../lib/snap-cn-ui";
import { fontFamily } from "../theme";
import { ClickScene, DockedScene, HookScene, InstallScene, MeetScene, MinimizeScene, OutroScene, ScaleScene, StarScene } from "./scenes";
import { BRAND, L } from "./ui";

// Slides, not fades: the scenes are transparent over one canvas, so a fade would
// draw both shots on top of each other for the whole overlap.
const beat = { presentation: slide(), timing: springTiming({ durationInFrames: 18, config: { damping: 200 } }) };

// 9 beats, 8 slides of 18f: 1220 - 144 = 1076 frames (about 36s).
export const LaunchLight: React.FC = () => (
  <SnapCnUIProvider
    mode="light"
    theme={{ background: BRAND.canvasTop, foreground: BRAND.ink, primary: BRAND.accent, mutedForeground: L.text2, border: L.border, fontFamily }}
  >
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BRAND.canvasTop} 0%, ${BRAND.canvasBottom} 100%)` }}>
      {/* Background music (scripts/make-music.mjs), under the click sounds; eases out over the last 2s. */}
      <Audio name="Music" src={staticFile("music/dockside-bed.wav")} volume={(f) => interpolate(f, [0, 20, 1016, 1076], [0, 0.32, 0.32, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      <TransitionSeries>
        <TransitionSeries.Sequence name="Hook" durationInFrames={90}>
          <HookScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...beat} />
        <TransitionSeries.Sequence name="Meet Dockside" durationInFrames={90}>
          <MeetScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...beat} />
        <TransitionSeries.Sequence name="Inside TradingView" durationInFrames={200}>
          <DockedScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...beat} />
        <TransitionSeries.Sequence name="One click" durationInFrames={150}>
          <ClickScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...beat} />
        <TransitionSeries.Sequence name="Minimize" durationInFrames={180}>
          <MinimizeScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...beat} />
        <TransitionSeries.Sequence name="1,000 symbols" durationInFrames={75}>
          <ScaleScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...beat} />
        <TransitionSeries.Sequence name="Install" durationInFrames={165}>
          <InstallScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...beat} />
        <TransitionSeries.Sequence name="Star the repo" durationInFrames={150}>
          <StarScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...beat} />
        <TransitionSeries.Sequence name="Outro" durationInFrames={120}>
          <OutroScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  </SnapCnUIProvider>
);
