import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig, staticFile } from "remotion";

export const KenBurns: React.FC<{ src: string; enabled: boolean }> = ({ src, enabled }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = enabled ? interpolate(frame, [0, durationInFrames], [1.0, 1.08], { extrapolateRight: "clamp" }) : 1;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
    </AbsoluteFill>
  );
};
