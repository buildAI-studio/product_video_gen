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
      capture: { kind: "titlecard" },
      caption: { primary: "IVMS", secondary: "Integrated Vehicle Management System" },
      duration: 3.5,
    },

    // RECORDING — open on the live dashboard, scroll to reveal the full overview.
    {
      id: "02-dashboard",
      capture: { kind: "interaction", route: "/", steps: [wait(700), scroll(520), wait(800), scroll(520), wait(900)] },
      caption: { primary: "One command center for the whole fleet", secondary: "Readiness, utilization and alerts at a glance" },
      trimStartSec: 2.0,
      duration: 5,
    },

    // RECORDING — navigate to the registry, scroll the vehicle table.
    {
      id: "03-vehicles",
      capture: { kind: "interaction", route: "/", steps: [goTo("Vehicle Management"), wait(1000), scroll(360), wait(800), scroll(360), wait(900)] },
      caption: { primary: "Every vehicle, tracked", secondary: "Registration, inspection and insurance expiry in one registry" },
      trimStartSec: 2.0,
      duration: 6,
    },

    // SPOTLIGHT — highlight the approval state on the maintenance board.
    {
      id: "04-maintenance",
      capture: { kind: "screenshot", route: "/", steps: [goTo("Maintenance Management"), wait(900)] },
      focus: { selector: "tbody tr", label: "Request status" },
      caption: { primary: "Maintenance, under control", secondary: "From request to approval to completion" },
      duration: 5,
    },

    // SPOTLIGHT — highlight a live stock status.
    {
      id: "05-inventory",
      capture: { kind: "screenshot", route: "/", steps: [goTo("Inventory Management"), wait(900)] },
      focus: { selector: "tbody tr", label: "Live stock" },
      caption: { primary: "Spare parts, never short", secondary: "Live stock levels with low-stock alerts" },
      duration: 5,
    },

    // SPOTLIGHT — highlight an active user / access status.
    {
      id: "06-users",
      capture: { kind: "screenshot", route: "/", steps: [goTo("User Management"), wait(900)] },
      focus: { selector: "tbody tr", label: "User & role" },
      caption: { primary: "The right access for every role", secondary: "Departments and permissions, centrally managed" },
      duration: 5,
    },

    // PLAIN hold — rental companies registry.
    {
      id: "07-rental",
      capture: { kind: "screenshot", route: "/", steps: [goTo("Rental Companies"), wait(900)] },
      caption: { primary: "Rental partners, organized", secondary: "Manage third-party vendors in one place" },
      duration: 4,
    },

    // RECORDING — reports center, hover a report type.
    {
      id: "08-reports",
      capture: { kind: "interaction", route: "/", steps: [goTo("Reports"), wait(1000), { action: "hover", selector: 'text=Maintenance Summary' }, wait(900)] },
      caption: { primary: "Decisions backed by data", secondary: "Fleet, maintenance and driver reports, exportable to PDF" },
      trimStartSec: 2.0,
      duration: 5,
    },

    // RECORDING — the audit trail, scrolling through logged actions.
    {
      id: "09-audit",
      capture: { kind: "interaction", route: "/", steps: [goTo("Audit Log"), wait(1000), scroll(320), wait(900)] },
      caption: { primary: "Full accountability", secondary: "Every action logged and searchable" },
      trimStartSec: 2.0,
      duration: 4.5,
    },
  ],
};

export default storyboard;
