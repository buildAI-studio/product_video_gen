export const ALL_STAGES = ["capture", "narrate", "render"] as const;
export type Stage = (typeof ALL_STAGES)[number];

export type ParsedArgs = {
  command: "run" | "init";
  product: string;
  only?: Stage;
  from?: Stage;
  force: boolean;
  preview: boolean;
  base: string;
};

function isStage(s: string | undefined): s is Stage {
  return !!s && (ALL_STAGES as readonly string[]).includes(s);
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  let command: "run" | "init" = "run";
  if (args[0] === "init") {
    command = "init";
    args.shift();
  }
  const product = args.shift() ?? "";

  const out: ParsedArgs = { command, product, force: false, preview: false, base: "products" };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--only" && isStage(args[i + 1])) out.only = args[++i] as Stage;
    else if (a === "--from" && isStage(args[i + 1])) out.from = args[++i] as Stage;
    else if (a === "--force") out.force = true;
    else if (a === "--preview") out.preview = true;
    else if (a === "--base" && args[i + 1]) out.base = args[++i]!;
  }
  return out;
}

export function stagesToRun(a: ParsedArgs): Stage[] {
  if (a.only) return [a.only];
  if (a.from) {
    const start = ALL_STAGES.indexOf(a.from);
    return ALL_STAGES.slice(start) as Stage[];
  }
  return [...ALL_STAGES];
}
