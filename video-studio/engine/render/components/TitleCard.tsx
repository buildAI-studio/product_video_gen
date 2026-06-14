import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { useTheme } from "../theme";

export const TitleCard: React.FC<{ bg?: string; logo?: boolean }> = ({ bg, logo }) => {
  const { theme } = useTheme();
  const background = bg ?? theme.palette.bg;
  return (
    <AbsoluteFill style={{ background, justifyContent: "center", alignItems: "center" }}>
      {logo && theme.logo ? (
        <Img src={staticFile(theme.logo)} style={{ maxWidth: "40%", maxHeight: "40%", objectFit: "contain" }} />
      ) : null}
    </AbsoluteFill>
  );
};
