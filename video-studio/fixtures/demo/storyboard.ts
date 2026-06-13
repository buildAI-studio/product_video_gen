import type { Storyboard } from "../../engine/schema";

const storyboard: Storyboard = {
  scenes: [
    { id: "01-title", capture: { kind: "titlecard", logo: false }, caption: { primary: "Demo" }, duration: 2, transitionOut: "fade" },
    { id: "02-home", capture: { kind: "screenshot", route: "/" }, caption: { primary: "Home" }, duration: 2, motion: "kenburns", transitionOut: "cut" },
  ],
};

export default storyboard;
