import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { useTheme } from "../theme";

export const Cursor: React.FC<{ targetX: number; targetY: number }> = ({ targetX, targetY }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const startX = Math.min(width - 20, targetX + 320);
  const startY = Math.min(height - 20, targetY + 240);
  const p = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 20 });
  const x = interpolate(p, [0, 1], [startX, targetX]);
  const y = interpolate(p, [0, 1], [startY, targetY]);
  const ripple = interpolate(frame, [22, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rippleSize = 8 + ripple * 46;
  const rippleOpacity = (1 - ripple) * 0.6;
  const { theme } = useTheme();
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x - rippleSize / 2, top: y - rippleSize / 2, width: rippleSize, height: rippleSize, borderRadius: "50%", border: `3px solid ${theme.palette.accent}`, opacity: rippleOpacity }} />
      <svg width={28} height={28} viewBox="0 0 24 24" style={{ position: "absolute", left: x, top: y, filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))" }}>
        <path d="M4 2 L4 20 L9 15 L12.5 22 L15 21 L11.5 14 L18 14 Z" fill="#ffffff" stroke="#000000" strokeWidth="1" />
      </svg>
    </AbsoluteFill>
  );
};
