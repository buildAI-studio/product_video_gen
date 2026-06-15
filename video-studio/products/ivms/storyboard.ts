import type { Storyboard } from "../../engine/schema";

// Switch to a sidebar tab (used inside interaction recordings and before spotlight stills).
const goTo = (label: string) =>
  ({ action: "click" as const, selector: `[data-sidebar="menu-button"]:has-text("${label}")` });
const wait = (ms: number) => ({ action: "wait" as const, for: ms });
const scroll = (px: number) => ({ action: "scroll" as const, to: px });

const storyboard: Storyboard = {
  defaults: { motion: "none", transitionOut: "fade" },
  scenes: [
    {
      id: "01-title",
      capture: { kind: "titlecard", bg: "#ffffff" },
      caption: { primary: "IVMS", secondary: "Integrated Vehicle Management System" },
      narration: "Meet the Integrated Vehicle Management System. One platform to run your entire fleet.",
      duration: "auto",
    },

    // RECORDING — open on the live dashboard, scroll to reveal the full overview.
    {
      id: "02-dashboard",
      capture: { kind: "interaction", route: "/", steps: [wait(700), scroll(520), wait(800), scroll(520), wait(900)] },
      caption: { primary: "One command center for the whole fleet", secondary: "Readiness, utilization and alerts at a glance" },
      narration: "It starts with a live command center — fleet readiness, utilization, and every alert at a glance.",
      trimStartSec: 2.0,
      duration: "auto",
    },

    // RECORDING — navigate to the registry, scroll the vehicle table.
    {
      id: "03-vehicles",
      capture: { kind: "interaction", route: "/", steps: [goTo("Vehicle Management"), wait(1000), scroll(360), wait(800), scroll(360), wait(900)] },
      caption: { primary: "Every vehicle, tracked", secondary: "Registration, inspection and insurance expiry in one registry" },
      narration: "Manage every vehicle in a single registry, with registration, inspection, and insurance expiry always tracked.",
      trimStartSec: 2.0,
      duration: "auto",
    },

    // SPOTLIGHT — highlight a request row on the maintenance board.
    {
      id: "04-maintenance",
      capture: { kind: "screenshot", route: "/", steps: [goTo("Maintenance Management"), wait(900)] },
      focus: { selector: "tbody tr", label: "Request status" },
      caption: { primary: "Maintenance, under control", secondary: "From request to approval to completion" },
      narration: "Keep maintenance under control — from request, to approval, to completion.",
      duration: "auto",
    },

    // SPOTLIGHT — highlight a stock row.
    {
      id: "05-inventory",
      capture: { kind: "screenshot", route: "/", steps: [goTo("Inventory Management"), wait(900)] },
      focus: { selector: "tbody tr", label: "Live stock" },
      caption: { primary: "Spare parts, never short", secondary: "Live stock levels with low-stock alerts" },
      narration: "Never run short on spare parts, with live stock levels and automatic low-stock alerts.",
      duration: "auto",
    },

    // SPOTLIGHT — highlight a user row.
    {
      id: "06-users",
      capture: { kind: "screenshot", route: "/", steps: [goTo("User Management"), wait(900)] },
      focus: { selector: "tbody tr", label: "User & role" },
      caption: { primary: "The right access for every role", secondary: "Departments and permissions, centrally managed" },
      narration: "Give every role exactly the right access — departments and permissions, centrally managed.",
      duration: "auto",
    },

    // PLAIN hold — rental companies registry.
    {
      id: "07-rental",
      capture: { kind: "screenshot", route: "/", steps: [goTo("Rental Companies"), wait(900)] },
      caption: { primary: "Rental partners, organized", secondary: "Manage third-party vendors in one place" },
      narration: "Coordinate your rental partners and third-party vendors, all in one place.",
      duration: "auto",
    },

    // RECORDING — reports center, hover a report type.
    {
      id: "08-reports",
      capture: { kind: "interaction", route: "/", steps: [goTo("Reports"), wait(1000), { action: "hover", selector: 'text=Maintenance Summary' }, wait(900)] },
      caption: { primary: "Decisions backed by data", secondary: "Fleet, maintenance and driver reports, exportable to PDF" },
      narration: "Make decisions backed by data — fleet, maintenance, and driver reports, ready to export.",
      trimStartSec: 2.0,
      duration: "auto",
    },

    // RECORDING — the audit trail, scrolling through logged actions.
    {
      id: "09-audit",
      capture: { kind: "interaction", route: "/", steps: [goTo("Audit Log"), wait(1000), scroll(320), wait(900)] },
      caption: { primary: "Full accountability", secondary: "Every action logged and searchable" },
      narration: "And with a complete audit trail, every action is logged — nothing slips through the cracks.",
      trimStartSec: 2.0,
      duration: "auto",
      transitionOut: "cut",
    },
  ],
};

export default storyboard;
