import React from "react";
import { AbsoluteFill } from "remotion";
import { useTheme } from "../theme";

export const TitleCard: React.FC = () => {
  const { theme } = useTheme();
  return <AbsoluteFill style={{ background: theme.palette.bg }} />;
};
