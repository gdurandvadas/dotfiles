declare const Bun: any;

import { tool } from "@opencode-ai/plugin";
import path from "path";

const ALLOWED_SUBCOMMANDS = new Set([
  "status",
  "diff",
  "log",
  "show",
  "branch",
  "tag",
  "remote",
  "rev-parse",
  "describe",
  "blame",
  "grep",
  "shortlog",
  "ls-files",
  "cat-file",
  "show-ref",
  "for-each-ref",
  "symbolic-ref",
  "stash",
  "reflog",
  "notes",
]);

/** Global flags that are always denied regardless of subcommand. */
const GLOBAL_DENIED_FLAGS = new Set([
  "-c",
  "--git-dir",
  "--work-tree",
  "--exec-path",
  "--super-prefix",
  "--bare",
  "--recurse-submodules",
]);

/** Per-subcommand deny rules. Each entry is a set of denied flags/subverbs. */
const SUBCOMMAND_DENIED_FLAGS: Record<string, Set<string>> = {
  branch: new Set([
    "-d",
    "-D",
    "-m",
    "-M",
    "-c",
    "-C",
    "--delete",
    "--move",
    "--copy",
    "--set-upstream-to",
    "--unset-upstream",
    "-u",
    "--edit-description",
  ]),
  tag: new Set([
    "-d",
    "-D",
    "-a",
    "-s",
    "-m",
    "-f",
    "--delete",
    "--sign",
    "--annotate",
    "--force",
    "--message",
  ]),
  "cat-file": new Set(["--batch-all-objects"]),
};

/** Subcommands with restricted subverbs — only listed subverbs are allowed. */
const SUBCOMMAND_ALLOWED_SUBVERBS: Record<string, Set<string>> = {
  stash: new Set(["list"]),
  reflog: new Set(["show"]),
  notes: new Set(["list", "show"]),
};

/** For `remote`, these subverbs are denied. */
const REMOTE_DENIED_SUBVERBS = new Set([
  "add",
  "remove",
  "rm",
  "set-url",
  "set-head",
  "set-branches",
  "update",
  "prune",
]);

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Validates git arguments against the allowlist and deny rules.
 * Returns `{ ok: true }` when the args are permitted, or
 * `{ ok: false, error: string }` when they are not.
 *
 * This function is pure — it never spawns a process.
 */
export function validateGitArgs(args: string[]): ValidationResult {
  if (args.length === 0) {
    return { ok: false, error: "args must contain at least one element" };
  }

  const subcommand = args[0].toLowerCase();

  if (!ALLOWED_SUBCOMMANDS.has(subcommand)) {
    return {
      ok: false,
      error: `Subcommand "${args[0]}" is not in the allowed list. Permitted subcommands: ${[...ALLOWED_SUBCOMMANDS].join(", ")}`,
    };
  }

  for (const arg of args) {
    const lower = arg.toLowerCase();

    if (GLOBAL_DENIED_FLAGS.has(lower)) {
      return {
        ok: false,
        error: `Flag "${arg}" is globally denied for security reasons.`,
      };
    }

    for (const denied of GLOBAL_DENIED_FLAGS) {
      if (lower.startsWith(`${denied}=`)) {
        return {
          ok: false,
          error: `Flag "${denied}" (in "${arg}") is globally denied for security reasons.`,
        };
      }
    }

    if (lower.startsWith("--recurse-submodules")) {
      return {
        ok: false,
        error: `Flag "--recurse-submodules" is globally denied.`,
      };
    }

    if (arg === "-C") {
      return {
        ok: false,
        error: `Flag "-C" is globally denied (changes working directory).`,
      };
    }
  }

  const restArgs = args.slice(1);

  if (subcommand === "remote") {
    for (const arg of restArgs) {
      const lower = arg.toLowerCase();
      if (REMOTE_DENIED_SUBVERBS.has(lower)) {
        return {
          ok: false,
          error: `"remote ${arg}" is denied. Only remote listing (-v/--verbose) and "get-url" are allowed.`,
        };
      }
    }
  } else if (subcommand in SUBCOMMAND_ALLOWED_SUBVERBS) {
    const allowedSubverbs = SUBCOMMAND_ALLOWED_SUBVERBS[subcommand]!;
    const subverb = restArgs.find((a) => !a.startsWith("-"))?.toLowerCase();
    if (subverb !== undefined && !allowedSubverbs.has(subverb)) {
      return {
        ok: false,
        error: `"${subcommand} ${subverb}" is denied. Only ${[...allowedSubverbs].join(", ")} subverb(s) are allowed for "${subcommand}".`,
      };
    }
  } else if (subcommand in SUBCOMMAND_DENIED_FLAGS) {
    const deniedFlags = SUBCOMMAND_DENIED_FLAGS[subcommand]!;
    for (const arg of restArgs) {
      const lower = arg.toLowerCase();
      if (deniedFlags.has(lower)) {
        return {
          ok: false,
          error: `Flag "${arg}" is denied for subcommand "${subcommand}".`,
        };
      }
      if (/^-[a-zA-Z]{2,}$/.test(arg)) {
        for (const ch of arg.slice(1)) {
          if (deniedFlags.has(`-${ch}`)) {
            return {
              ok: false,
              error: `Flag "-${ch}" (within "${arg}") is denied for subcommand "${subcommand}".`,
            };
          }
        }
      }
    }
  }

  return { ok: true };
}

function buildErrorResponse(
  error: string,
  cmd: string[],
  cwd: string,
): string {
  return JSON.stringify(
    {
      ok: false,
      exitCode: null,
      stdout: "",
      stderr: "",
      cmd,
      cwd,
      durationMs: 0,
      truncated: false,
      error,
    },
    null,
    2,
  );
}

export default tool({
  description: `Fallback read-only git tool — only use this when the bash tool is NOT available. When bash is available, prefer running git directly via bash instead. Only a conservative allowlist of local, non-destructive git subcommands is permitted. Network operations (fetch, pull, push, clone, ls-remote) are always denied. Pass git arguments as an array (omit the "git" prefix). Examples:
  args: ["status", "--porcelain=v2"]
  args: ["log", "--oneline", "-10"]
  args: ["diff", "HEAD~1"]
  args: ["branch", "-a"]
  args: ["ls-files"]`,
  args: {
    args: tool.schema
      .array(tool.schema.string())
      .min(1)
      .describe(
        'Git arguments (without the "git" prefix). First element must be an allowed subcommand. Example: ["log","--oneline","-10"]',
      ),
    cwd: tool.schema
      .string()
      .optional()
      .describe("Working directory. Defaults to process.cwd()."),
    timeoutMs: tool.schema
      .number()
      .optional()
      .default(15000)
      .describe("Timeout in milliseconds. Default 15000. Max 60000."),
    maxOutputChars: tool.schema
      .number()
      .optional()
      .default(30000)
      .describe("Maximum output characters. Default 30000."),
  },
  async execute(args, _context) {
    const gitArgs = args.args;
    const effectiveCwd = path.resolve(args.cwd ?? process.cwd());
    const effectiveTimeout = Math.min(args.timeoutMs ?? 15000, 60000);
    const maxChars = args.maxOutputChars ?? 30000;

    const validation = validateGitArgs(gitArgs);
    if (!validation.ok) {
      return buildErrorResponse(validation.error, ["git", ...gitArgs], effectiveCwd);
    }

    const gitPath: string = Bun.which("git") ?? "git";
    const cmd = [gitPath, "--no-pager", ...gitArgs];

    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      const proc = Bun.spawn(cmd, {
        cwd: effectiveCwd,
        stdout: "pipe",
        stderr: "pipe",
        signal: controller.signal,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
          GIT_PAGER: "cat",
          PAGER: "cat",
          GIT_EDITOR: "true",
          GIT_OPTIONAL_LOCKS: "0",
          LC_ALL: "C",
        },
      });

      const [stdoutBuf, stderrBuf] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);

      const exitCode: number = await proc.exited;
      const durationMs = Date.now() - start;

      const truncateStr = (s: string): string =>
        s.length > maxChars ? s.slice(0, maxChars) : s;

      const truncated = stdoutBuf.length > maxChars || stderrBuf.length > maxChars;

      return JSON.stringify(
        {
          ok: exitCode === 0,
          exitCode,
          stdout: truncateStr(stdoutBuf),
          stderr: truncateStr(stderrBuf),
          cmd,
          cwd: effectiveCwd,
          durationMs,
          truncated,
        },
        null,
        2,
      );
    } catch (e: unknown) {
      const durationMs = Date.now() - start;
      const isTimeout =
        e instanceof Error && e.name === "AbortError";
      const errorMessage = isTimeout
        ? `Command timed out after ${effectiveTimeout}ms`
        : e instanceof Error
          ? e.message
          : String(e);

      return JSON.stringify(
        {
          ok: false,
          exitCode: null,
          stdout: "",
          stderr: "",
          cmd,
          cwd: effectiveCwd,
          durationMs,
          truncated: false,
          error: errorMessage,
        },
        null,
        2,
      );
    } finally {
      clearTimeout(timer);
    }
  },
});
