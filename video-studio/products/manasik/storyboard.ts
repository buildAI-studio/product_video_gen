import type { Storyboard } from "../../engine/schema";

const storyboard: Storyboard = {
  defaults: { motion: "kenburns", transitionOut: "fade" },
  scenes: [
    { id: "01-title", capture: { kind: "titlecard", logo: true }, caption: { primary: "مناسك", secondary: "Manasik" }, narration: "Manasik — Hajj VIP operations, unified.", duration: 3 },
    { id: "02-role-select", capture: { kind: "screenshot", route: "/" }, caption: { primary: "مصمَّم لكل دور في العملية", secondary: "Built for every role on the ground." }, narration: "Built for every role on the ground.", duration: 4 },
    { id: "03-dashboard", capture: { kind: "screenshot", route: "/dashboard" }, caption: { primary: "عرض واحد لكل الرحلة", secondary: "One live view of the entire journey." }, narration: "One live view of the entire journey.", duration: 8 },
    { id: "04-movement", capture: { kind: "screenshot", route: "/movement" }, caption: { primary: "من المطار إلى عرفات", secondary: "From the airport to Arafat — every stage tracked." }, narration: "From the airport to Arafat — every stage tracked.", duration: 8 },
    { id: "05-guest", capture: { kind: "screenshot", route: "/guests/[firstId]" }, caption: { primary: "كل ضيف، كل تفصيل", secondary: "Every guest, every touchpoint, in one profile." }, narration: "Every guest, every touchpoint, in one profile.", duration: 6 },
    { id: "06-convoys", capture: { kind: "screenshot", route: "/convoy-control" }, caption: { primary: "تنسيق القوافل لحظة بلحظة", secondary: "Coordinate convoys in real time." }, narration: "Coordinate convoys in real time.", duration: 6 },
    { id: "07-flights", capture: { kind: "screenshot", route: "/flights" }, caption: { primary: "الوصول والمغادرة بنظرة", secondary: "Arrivals and departures at a glance." }, narration: "Arrivals and departures at a glance.", duration: 5 },
    { id: "08-accommodation", capture: { kind: "screenshot", route: "/accommodation" }, caption: { primary: "الغرف والقاعات والطاقة", secondary: "Rooms, halls, capacity — always current." }, narration: "Rooms, halls, capacity — always current.", duration: 5 },
    { id: "09-communications", capture: { kind: "screenshot", route: "/communications" }, caption: { primary: "تواصل فوري مع الضيوف", secondary: "Reach any guest instantly." }, narration: "Reach any guest instantly.", duration: 6 },
    { id: "10-emergency", capture: { kind: "screenshot", route: "/emergency" }, caption: { primary: "استجابة منسّقة للحوادث", secondary: "Incident response, coordinated." }, narration: "Incident response, coordinated.", duration: 5 },
    { id: "11-scan", capture: { kind: "screenshot", route: "/scan" }, caption: { primary: "تسجيل دخول بلمسة", secondary: "Check in with a tap." }, narration: "Check in with a tap.", duration: 4 },
    { id: "12-reports", capture: { kind: "screenshot", route: "/reports" }, caption: { primary: "قرارات مبنية على البيانات", secondary: "Decisions backed by data." }, narration: "Decisions backed by data.", duration: 6, transitionOut: "cut" },
  ],
};

export default storyboard;
