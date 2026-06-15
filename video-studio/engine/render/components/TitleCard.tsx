import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { useTheme } from "../theme";

/** Pick a readable text color (near-black or white) for the given background. */
function readableText(bg: string): string {
  const h = bg.replace("#", "");
  if (h.length < 6) return "#0b0f0e";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0b0f0e" : "#ffffff";
}

export const TitleCard: React.FC<{ bg?: string; logo?: boolean; title?: { primary: string; secondary?: string } }> = ({
  bg,
  logo,
  title,
}) => {
  const { theme } = useTheme();
  const frame = useCurrentFrame();
  const background = bg ?? theme.palette.bg;
  const fg = readableText(background);
  const subFg = fg === "#0b0f0e" ? "#475569" : theme.palette.accent;
  const opacity = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const rise = interpolate(frame, [0, 16], [16, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center", opacity, transform: `translateY(${rise}px)` }}>
        {logo && theme.logo ? (
          <Img src={staticFile(theme.logo)} style={{ maxWidth: 420, maxHeight: 220, objectFit: "contain", marginBottom: 28 }} />
        ) : null}
        {title ? (
          <>
            <div style={{ color: fg, fontFamily: theme.fonts.heading, fontSize: 168, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>
              {title.primary}
            </div>
            {title.secondary ? (
              <div style={{ color: subFg, fontFamily: theme.fonts.body, fontSize: 46, fontWeight: 600, marginTop: 24 }}>
                {title.secondary}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
