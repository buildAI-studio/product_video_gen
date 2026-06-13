import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { Video, type VideoProps } from "./Video";
import { totalFrames } from "./schedule";

const calc: CalculateMetadataFunction<VideoProps> = ({ props }) => ({
  durationInFrames: Math.max(1, totalFrames(props.schedule)),
  fps: props.fps,
  width: props.width,
  height: props.height,
});

const DEFAULT_PROPS: VideoProps = {
  schedule: [],
  theme: { palette: { bg: "#000000", fg: "#ffffff", accent: "#888888" }, fonts: { heading: "sans-serif", body: "sans-serif" }, direction: "ltr" },
  locale: { primary: "en" },
  fps: 30,
  width: 1920,
  height: 1080,
};

/** Browser-safe Remotion root. The CLI injects real values via inputProps at render time. */
export const RemotionRoot: React.FC = () => (
  <Composition
    id="ProductVideo"
    component={Video}
    calculateMetadata={calc}
    durationInFrames={1}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={DEFAULT_PROPS}
  />
);
