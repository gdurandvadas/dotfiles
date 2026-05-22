import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type RepoStatus = {
  name: string;
  branch: string;
  dirty: boolean;
  untracked: boolean;
  ahead: number;
  behind: number;
  additions: number;
  deletions: number;
};

const colors = {
  reset: "\x1b[0m",
  branch: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  purple: "\x1b[35m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

export default function repoStatusExtension(pi: ExtensionAPI) {
  let lastTurnSummary = "";

  const execute = async (_args?: string, ctx?: { ui?: { notify?: (message: string) => void } }) => {
    const summary = generateWorkspaceStatus(process.cwd(), true);
    if (ctx?.ui?.notify) {
      ctx.ui.notify(summary || "No Git repositories found.");
    } else if (summary) {
      console.log(summary);
    }
  };

  const api = pi as unknown as {
    registerCommand: Function;
    on?: (eventName: string, handler: (event: unknown) => void) => void;
  };

  if (api.registerCommand.length >= 2) {
    api.registerCommand("repo-status", {
      description: "Display a visual status panel for Git repositories in this workspace",
      execute,
    });
  } else {
    api.registerCommand({
      name: "repo-status",
      description: "Display a visual status panel for Git repositories in this workspace",
      execute,
    });
  }

  api.on?.("message_end", (event: any) => {
    if (event?.message?.role && event.message.role !== "assistant") return;

    const summary = generateWorkspaceStatus(process.cwd(), false);
    if (!summary || summary === lastTurnSummary) return;

    lastTurnSummary = summary;
    console.log(`\n${summary}\n`);
  });
}

function generateWorkspaceStatus(rootDir: string, includeClean: boolean): string {
  const repos = discoverRepos(rootDir)
    .map(readRepoStatus)
    .filter((status): status is RepoStatus => Boolean(status))
    .filter((status) => includeClean || status.dirty || status.ahead > 0 || status.behind > 0);

  if (repos.length === 0) return "";

  return repos.map(formatRepoStatus).join("\n");
}

function discoverRepos(rootDir: string): Array<{ name: string; dir: string }> {
  const repos: Array<{ name: string; dir: string }> = [];

  if (isGitRepo(rootDir)) {
    repos.push({ name: path.basename(rootDir), dir: rootDir });
  }

  for (const item of fs.readdirSync(rootDir)) {
    if (item.startsWith(".")) continue;

    const itemPath = path.join(rootDir, item);
    if (!fs.statSync(itemPath).isDirectory()) continue;
    if (isGitRepo(itemPath)) repos.push({ name: item, dir: itemPath });
  }

  return repos;
}

function isGitRepo(dir: string): boolean {
  return fs.existsSync(path.join(dir, ".git"));
}

function readRepoStatus(repo: { name: string; dir: string }): RepoStatus | undefined {
  try {
    const branch = git(repo.dir, "rev-parse --abbrev-ref HEAD");
    if (!branch || branch === "HEAD") return undefined;

    const statusLines = git(repo.dir, "status --porcelain=v2 --branch").split("\n");
    let ahead = 0;
    let behind = 0;
    let dirty = false;
    let untracked = false;

    for (const line of statusLines) {
      if (line.startsWith("# branch.ab")) {
        const match = line.match(/\+(\d+)\s+-(\d+)/);
        if (match) {
          ahead = Number.parseInt(match[1], 10);
          behind = Number.parseInt(match[2], 10);
        }
      } else if (line.trim() && !line.startsWith("#")) {
        dirty = true;
        if (line.startsWith("?")) untracked = true;
      }
    }

    const { additions, deletions } = readDiffCounts(repo.dir);
    return { name: repo.name, branch, dirty, untracked, ahead, behind, additions, deletions };
  } catch {
    return undefined;
  }
}

function readDiffCounts(dir: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  try {
    for (const line of git(dir, "diff --numstat").split("\n")) {
      if (!line) continue;
      const [add, del] = line.split("\t");
      if (add !== "-" && del !== "-") {
        additions += Number.parseInt(add, 10);
        deletions += Number.parseInt(del, 10);
      }
    }
  } catch {
    return { additions: 0, deletions: 0 };
  }

  return { additions, deletions };
}

function formatRepoStatus(status: RepoStatus): string {
  const cleanState = status.dirty
    ? `${colors.red}✗${colors.reset}`
    : `${colors.green}✔${colors.reset}`;
  const ahead = status.ahead > 0 ? ` ${colors.purple}⇡${status.ahead}${colors.reset}` : "";
  const behind = status.behind > 0 ? ` ${colors.blue}⇣${status.behind}${colors.reset}` : "";
  const untracked = status.untracked ? ` ${colors.cyan}%${colors.reset}` : "";
  const diff =
    status.additions > 0 || status.deletions > 0
      ? ` ${colors.green}+${status.additions}${colors.reset} ${colors.red}-${status.deletions}${colors.reset}`
      : "";

  return [
    `${colors.dim}${status.name}${colors.reset}`,
    `<${colors.branch} ${status.branch}${colors.reset}>`,
    `<${cleanState}${ahead}${behind}${untracked}${diff}>`,
  ].join(" ");
}

function git(cwd: string, command: string): string {
  return execSync(`git ${command}`, { cwd, stdio: "pipe" }).toString().trim();
}
