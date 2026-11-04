import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { useVideoConfig } from "remotion";
import {
  ClickScene,
  DockedScene,
  InstallScene,
  IntroScene,
  ListsScene,
  MinimizeScene,
  OutroScene,
  PasteScene,
  PricesScene,
  SafeScene,
  SearchScene,
  ThousandScene,
} from "./scenes";

// 12 scenes, 11 crossfades of half a second. Total: 66.5s of scenes - 5.5s of overlap = 61s.
export const LaunchVideo: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence name="Title" durationInFrames={4 * fps}>
        <IntroScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />
      <TransitionSeries.Sequence name="1,000 symbols" durationInFrames={3.5 * fps}>
        <ThousandScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />
      <TransitionSeries.Sequence name="Docked in TradingView" durationInFrames={6.5 * fps}>
        <DockedScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />
      <TransitionSeries.Sequence name="Click to switch" durationInFrames={5.5 * fps}>
        <ClickScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />
      <TransitionSeries.Sequence name="Search" durationInFrames={6 * fps}>
        <SearchScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />
      <TransitionSeries.Sequence name="Lists and tags" durationInFrames={5 * fps}>
        <ListsScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />
      <TransitionSeries.Sequence name="Live prices" durationInFrames={5 * fps}>
        <PricesScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />
      <TransitionSeries.Sequence name="Minimize" durationInFrames={7 * fps}>
        <MinimizeScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />
      <TransitionSeries.Sequence name="Bulk add" durationInFrames={5.5 * fps}>
        <PasteScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />
      <TransitionSeries.Sequence name="Polite to TradingView" durationInFrames={4.5 * fps}>
        <SafeScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />
      <TransitionSeries.Sequence name="Install" durationInFrames={9 * fps}>
        <InstallScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />
      <TransitionSeries.Sequence name="Outro" durationInFrames={5 * fps}>
        <OutroScene />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
