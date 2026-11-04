import { Composition, Folder, Still } from "remotion";
import { LaunchVideo } from "./LaunchVideo";
import { LaunchLight } from "./light/LaunchLight";
import { SymbolCard } from "./light/ui";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="DocksideLaunch" component={LaunchLight} durationInFrames={1076} fps={30} width={1280} height={720} />
      <Composition id="DocksideLaunchDark" component={LaunchVideo} durationInFrames={1830} fps={30} width={1920} height={1080} />
      <Folder name="Assets">
        {/* Rendered to public/cards/<t>.png for the "1,000 symbols" grid. */}
        <Still id="SymbolCard" component={SymbolCard} width={360} height={480} defaultProps={{ t: "SSWL", p: 518.5, pct: 1.16 }} />
      </Folder>
    </>
  );
};
