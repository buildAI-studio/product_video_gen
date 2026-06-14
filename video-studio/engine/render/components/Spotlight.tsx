import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../theme";

export type FocusBox = { x: number; y: number; w: number; h: number; label?: string };

export const Spotlight: React.FC<{ focus: FocusBox }> = ({ focus }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { theme } = useTheme();
  const pad = 10;
  const x = Math.max(0, focus.x - pad), y = Math.max(0, focus.y - pad);
  const w = focus.w + pad * 2, h = focus.h + pad * 2;
  const dim = interpolate(frame, [6, 22], [0, 0.55], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ring = interpolate(frame, [10, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <svg width={width} height={height} style={{ position: "absolute" }}>
        <defs>
          <mask id="spot">
            <rect width={width} height={height} fill="white" />
            <rect x={x} y={y} width={w} height={h} rx={14} ry={14} fill="black" />
          </mask>
        </defs>
        <rect width={width} height={height} fill={`rgba(0,0,0,${dim})`} mask="url(#spot)" />
        <rect x={x} y={y} width={w} height={h} rx={14} ry={14} fill="none" stroke={theme.palette.accent} strokeWidth={3} opacity={ring} />
      </svg>
      {focus.label ? (
        <div style={{ position: "absolute", left: x, top: Math.max(8, y - 44), background: theme.palette.accent, color: "#04201b", fontFamily: theme.fonts.body, fontWeight: 700, fontSize: 22, padding: "6px 14px", borderRadius: 8, opacity: ring }}>{focus.label}</div>
      ) : null}
    </AbsoluteFill>
  );
};
