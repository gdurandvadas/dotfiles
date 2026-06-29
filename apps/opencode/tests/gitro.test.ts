import { describe, expect, test } from "bun:test";
import { validateGitArgs } from "../tools/gitro";
import path from "path";
import os from "os";
import fs from "fs/promises";

describe("validateGitArgs — allowed subcommands", () => {
  test("allowed subcommand 'status' passes validation", () => {
    const result = validateGitArgs(["status"]);
    expect(result.ok).toBe(true);
  });

  test("allowed subcommand 'log' passes validation", () => {
    const result = validateGitArgs(["log", "--oneline", "-10"]);
    expect(result.ok).toBe(true);
  });
});

describe("validateGitArgs — denied network/write subcommands", () => {
  test("denied subcommand 'push' returns error without running git", () => {
    const result = validateGitArgs(["push", "origin", "main"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("push");
  });

  test("denied subcommand 'clone' returns error", () => {
    const result = validateGitArgs(["clone", "https://example.com/repo"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("clone");
  });

  test("denied subcommand 'fetch' returns error", () => {
    const result = validateGitArgs(["fetch"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("fetch");
  });

  test("denied subcommand 'pull' returns error", () => {
    const result = validateGitArgs(["pull"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("pull");
  });

  test("denied subcommand 'ls-remote' returns error (not in allowlist)", () => {
    const result = validateGitArgs(["ls-remote", "origin"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("ls-remote");
  });
});

describe("validateGitArgs — global denied flags", () => {
  test("denied global flag '-C' in args returns error", () => {
    const result = validateGitArgs(["log", "-C", "/tmp"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("-C");
  });

  test("denied global flag '--git-dir' in args returns error", () => {
    const result = validateGitArgs(["log", "--git-dir=/tmp/.git"]);
    expect(result.ok).toBe(false);
  });

  test("denied global flag '--work-tree' in args returns error", () => {
    const result = validateGitArgs(["status", "--work-tree=/tmp"]);
    expect(result.ok).toBe(false);
  });
});

describe("validateGitArgs — branch per-subcommand deny rules", () => {
  test("denied 'branch -D main' returns error", () => {
    const result = validateGitArgs(["branch", "-D", "main"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("-D");
  });

  test("denied 'branch --delete main' returns error", () => {
    const result = validateGitArgs(["branch", "--delete", "main"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("--delete");
  });
});

describe("validateGitArgs — tag per-subcommand deny rules", () => {
  test("denied 'tag -d v1.0' returns error", () => {
    const result = validateGitArgs(["tag", "-d", "v1.0"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("-d");
  });

  test("denied 'tag -a v1.0' returns error", () => {
    const result = validateGitArgs(["tag", "-a", "v1.0", "-m", "msg"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("-a");
  });
});

describe("validateGitArgs — remote per-subcommand deny rules", () => {
  test("denied 'remote add origin url' returns error", () => {
    const result = validateGitArgs(["remote", "add", "origin", "https://example.com"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("add");
  });

  test("denied 'remote set-url origin url' returns error", () => {
    const result = validateGitArgs(["remote", "set-url", "origin", "https://example.com"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("set-url");
  });

  test("allowed 'remote -v' passes validation", () => {
    const result = validateGitArgs(["remote", "-v"]);
    expect(result.ok).toBe(true);
  });
});

describe("validateGitArgs — config fully denied", () => {
  test("denied 'config --get user.email' returns error", () => {
    const result = validateGitArgs(["config", "--get", "user.email"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("config");
  });
});

describe("validateGitArgs — stash restricted subverbs", () => {
  test("denied 'stash pop' returns error", () => {
    const result = validateGitArgs(["stash", "pop"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("pop");
  });

  test("allowed 'stash list' passes validation", () => {
    const result = validateGitArgs(["stash", "list"]);
    expect(result.ok).toBe(true);
  });
});

describe("validateGitArgs — global --recurse-submodules deny", () => {
  test("denied '--recurse-submodules' globally returns error", () => {
    const result = validateGitArgs(["diff", "--recurse-submodules"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("recurse-submodules");
  });
});

describe("validateGitArgs — cat-file per-subcommand deny rules", () => {
  test("denied 'cat-file --batch-all-objects' returns error", () => {
    const result = validateGitArgs(["cat-file", "--batch-all-objects"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("--batch-all-objects");
  });
});

describe("validateGitArgs — reflog restricted subverbs", () => {
  test("denied 'reflog expire' returns error", () => {
    const result = validateGitArgs(["reflog", "expire"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("expire");
  });

  test("allowed 'reflog show' passes validation", () => {
    const result = validateGitArgs(["reflog", "show"]);
    expect(result.ok).toBe(true);
  });
});

describe("validateGitArgs — schema min(1) enforcement", () => {
  test("empty args array is rejected", () => {
    const result = validateGitArgs([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });
});

const hasGit = !!Bun.which("git");

describe("gitro integration — execute real git command", () => {
  if (!hasGit) {
    test.skip("git not found in PATH — skipping integration test", () => {});
    return;
  }

  test("runs 'status' in a fresh git repo and returns ok:true", async () => {
    const tmpDir = path.join(os.tmpdir(), `gitro-test-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });

    try {
      const initProc = Bun.spawn(["git", "init", tmpDir], {
        stdout: "pipe",
        stderr: "pipe",
      });
      await initProc.exited;

      const mod = await import("../tools/gitro");
      const gitroTool = mod.default;

      const raw: string = await gitroTool.execute(
        { args: ["status"], cwd: tmpDir, timeoutMs: 15000, maxOutputChars: 30000 },
        {} as any,
      );

      const result = JSON.parse(raw);

      expect(result.ok).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(typeof result.stdout).toBe("string");
      expect(typeof result.durationMs).toBe("number");
      expect(result.truncated).toBe(false);
      expect(result.cwd).toBe(tmpDir);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
