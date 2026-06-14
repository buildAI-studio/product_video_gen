import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, staticFile } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import type { ProductConfigData } from "../schema";
import type { ScheduledScene } from "./schedule";
import { ThemeProvider } from "./theme";
import { Caption } from "./components/Caption";
import { KenBurns } from "./components/KenBurns";
import { TitleCard } from "./components/TitleCard";
import { TRANSITION_FRAMES } from "./constants";

export type VideoProps = {
  schedule: ScheduledScene[];
  theme: ProductConfigData["theme"];
  locale: ProductConfigData["locale"];
  fps: number;
  width: number;
  height: number;
};

const SceneBody: React.FC<{ scene: ScheduledScene }> = ({ scene }) => (
  <AbsoluteFill>
    {scene.kind === "titlecard" ? (
      <TitleCard bg={scene.titlecard?.bg} logo={scene.titlecard?.logo} />
    ) : scene.kind === "interaction" ? (
      <OffthreadVideo src={staticFile(scene.asset)} />
    ) : (
      <KenBurns src={scene.asset} enabled={scene.motion === "kenburns"} />
    )}
    {scene.caption ? <Caption primary={scene.caption.primary} secondary={scene.caption.secondary} /> : null}
    {scene.audio ? <Audio src={staticFile(scene.audio)} /> : null}
  </AbsoluteFill>
);

export const Video: React.FC<VideoProps> = ({ schedule, theme, locale }) => {
  return (
    <ThemeProvider theme={theme} locale={locale}>
      <AbsoluteFill style={{ background: theme.palette.bg }}>
        <TransitionSeries>
          {schedule.flatMap((scene, i) => {
            const seq = (
              <TransitionSeries.Sequence key={scene.id} durationInFrames={scene.durationInFrames}>
                <SceneBody scene={scene} />
              </TransitionSeries.Sequence>
            );
            const prev = schedule[i - 1];
            if (i === 0 || !prev || prev.transitionOut === "cut") return [seq];
            const presentation =
              prev.transitionOut === "slide"
                ? slide({ direction: theme.direction === "rtl" ? "from-right" : "from-left" })
                : fade();
            return [
              <TransitionSeries.Transition key={`t-${scene.id}`} presentation={presentation} timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })} />,
              seq,
            ];
          })}
        </TransitionSeries>
      </AbsoluteFill>
    </ThemeProvider>
  );
};
