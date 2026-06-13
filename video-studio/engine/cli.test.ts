import { test, expect } from "bun:test";
import { parseArgs, stagesToRun, ALL_STAGES } from "./stages";

test("parses product name and defaults to all stages", () => {
  const a = parseArgs(["manasik"]);
  expect(a.product).toBe("manasik");
  expect(stagesToRun(a)).toEqual([...ALL_STAGES]);
});

test("--only restricts to one stage", () => {
  expect(stagesToRun(parseArgs(["manasik", "--only", "capture"]))).toEqual(["capture"]);
});

test("--from runs that stage onward", () => {
  expect(stagesToRun(parseArgs(["manasik", "--from", "narrate"]))).toEqual(["narrate", "render"]);
});

test("--force and --preview flags are parsed", () => {
  const a = parseArgs(["manasik", "--force", "--preview"]);
  expect(a.force).toBe(true);
  expect(a.preview).toBe(true);
});

test("init subcommand is recognized", () => {
  expect(parseArgs(["init", "newproduct"]).command).toBe("init");
});
