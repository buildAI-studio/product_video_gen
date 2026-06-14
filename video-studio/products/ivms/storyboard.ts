import type { Storyboard } from "../../engine/schema";

// Click a sidebar tab by its label, then let it settle, before screenshotting.
const tab = (label: string) => [
  { action: "click" as const, selector: `[data-sidebar="menu-button"]:has-text("${label}")` },
  { action: "wait" as const, for: 900 },
];

const storyboard: Storyboard = {
  defaults: { motion: "kenburns", transitionOut: "fade" },
  scenes: [
    {
      id: "01-title",
      capture: { kind: "titlecard" },
      caption: { primary: "IVMS", secondary: "Integrated Vehicle Management System" },
      duration: 3.5,
    },
    {
      id: "02-dashboard",
      capture: { kind: "screenshot", route: "/" },
      caption: { primary: "One command center for the whole fleet", secondary: "Readiness, utilization and alerts at a glance" },
      duration: 6,
    },
    {
      id: "03-vehicles",
      capture: { kind: "screenshot", route: "/", steps: tab("Vehicle Management") },
      caption: { primary: "Every vehicle, tracked", secondary: "Registration, inspection and insurance expiry in one registry" },
      duration: 5,
    },
    {
      id: "04-maintenance",
      capture: { kind: "screenshot", route: "/", steps: tab("Maintenance Management") },
      caption: { primary: "Maintenance, under control", secondary: "From request to approval to completion" },
      duration: 5,
    },
    {
      id: "05-inventory",
      capture: { kind: "screenshot", route: "/", steps: tab("Inventory Management") },
      caption: { primary: "Spare parts, never short", secondary: "Live stock levels with low-stock alerts" },
      duration: 5,
    },
    {
      id: "06-users",
      capture: { kind: "screenshot", route: "/", steps: tab("User Management") },
      caption: { primary: "The right access for every role", secondary: "Departments and permissions, centrally managed" },
      duration: 5,
    },
    {
      id: "07-rental",
      capture: { kind: "screenshot", route: "/", steps: tab("Rental Companies") },
      caption: { primary: "Rental partners, organized", secondary: "Manage third-party vendors in one place" },
      duration: 5,
    },
    {
      id: "08-reports",
      capture: { kind: "screenshot", route: "/", steps: tab("Reports") },
      caption: { primary: "Decisions backed by data", secondary: "Fleet, maintenance and driver reports, exportable to PDF" },
      duration: 5,
    },
    {
      id: "09-audit",
      capture: { kind: "screenshot", route: "/", steps: tab("Audit Log") },
      caption: { primary: "Full accountability", secondary: "Every action logged and searchable" },
      duration: 5,
      transitionOut: "cut",
    },
  ],
};

export default storyboard;
