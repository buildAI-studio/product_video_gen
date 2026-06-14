import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { useTheme } from "../theme";

export const Caption: React.FC<{ primary: string; secondary?: string }> = ({ primary, secondary }) => {
  const { theme } = useTheme();
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const align = theme.direction === "rtl" ? "flex-end" : "flex-start";

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: align, padding: 80, opacity }}>
      <div style={{ direction: theme.direction, textAlign: theme.direction === "rtl" ? "right" : "left" }}>
        <div style={{ color: theme.palette.fg, fontFamily: theme.fonts.heading, fontSize: 64, fontWeight: 700 }}>{primary}</div>
        {secondary ? (
          <div style={{ color: theme.palette.accent, fontFamily: theme.fonts.body, fontSize: 36, marginTop: 8 }}>{secondary}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
