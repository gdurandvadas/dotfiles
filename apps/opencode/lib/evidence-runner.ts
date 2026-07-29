import { spawn } from "node:child_process";
import {
  createWriteStream,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";

interface EvidenceRunnerSpec {
  command: string[];
  cwd: string;
  timeout_ms: number;
  log_path: string;
  result_path: string;
}

interface EvidenceRunnerResult {
  completed_at: string;
  duration_ms: number;
  exit_code: number | null;
  signal: NodeJS.Signals | null;
  timed_out: boolean;
  error?: string;
}

function finish(path: string, result: EvidenceRunnerResult): void {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(result, null, 2)}\n`);
  renameSync(temporary, path);
}

function terminateGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // The process already exited.
    }
  }
}

const specPath = process.argv[2];
if (!specPath) throw new Error("Evidence runner requires a job specification path");
const spec = JSON.parse(readFileSync(specPath, "utf8")) as EvidenceRunnerSpec;
const started = Date.now();
const log = createWriteStream(spec.log_path, { flags: "a" });
log.write([
  `command: ${JSON.stringify(spec.command)}`,
  `started_at: ${new Date(started).toISOString()}`,
  `timeout_ms: ${spec.timeout_ms}`,
  "",
].join("\n"));

const child = spawn(spec.command[0]!, spec.command.slice(1), {
  cwd: spec.cwd,
  shell: false,
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });

let timedOut = false;
let finalized = false;
let forcedTimer: ReturnType<typeof setTimeout> | undefined;
const timeout = setTimeout(() => {
  timedOut = true;
  log.write(`\n[evidence-runner] timed out after ${spec.timeout_ms}ms; terminating process group\n`);
  terminateGroup(child.pid!, "SIGTERM");
  forcedTimer = setTimeout(() => terminateGroup(child.pid!, "SIGKILL"), 5_000);
  forcedTimer.unref();
}, spec.timeout_ms);
timeout.unref();

function finalize(result: EvidenceRunnerResult, trailer: string): void {
  if (finalized) return;
  finalized = true;
  clearTimeout(timeout);
  if (forcedTimer) clearTimeout(forcedTimer);
  log.end(trailer, () => finish(spec.result_path, result));
}

child.once("error", (error) => {
  finalize(
    {
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      exit_code: null,
      signal: null,
      timed_out: timedOut,
      error: error.message,
    },
    `\n[evidence-runner] spawn error: ${error.message}\n`,
  );
});

child.once("close", (code, signal) => {
  finalize(
    {
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - started,
        exit_code: code,
        signal,
        timed_out: timedOut,
    },
    `\n[evidence-runner] completed exit=${code ?? "null"} signal=${signal ?? ""}\n`,
  );
});
