export type CommandOptions = {
  cwd?: string
  env?: Record<string, string>
  stdin?: string | Uint8Array
  signal?: AbortSignal
  timeoutMs?: number
  outputLimitCharacters?: number
}

export type CommandResult = {
  exitCode: number
  stdout: string
  stderr: string
  aborted?: boolean
  timedOut?: boolean
  durationMs?: number
}

export interface CommandRunner {
  run(argv: string[], options?: CommandOptions): Promise<CommandResult>
}

const TERMINATION_GRACE_MS = 1_000

async function readOutput(
  stream: ReadableStream<Uint8Array>,
  maximum?: number,
): Promise<string> {
  if (maximum === undefined) return new Response(stream).text()
  if (!Number.isInteger(maximum) || maximum <= 0) {
    throw new Error("outputLimitCharacters must be a positive integer")
  }

  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const headLimit = Math.ceil(maximum / 2)
  const tailLimit = Math.floor(maximum / 2)
  let head = ""
  let tail = ""
  let total = 0

  const append = (chunk: string) => {
    total += chunk.length
    if (head.length < headLimit) {
      const available = headLimit - head.length
      head += chunk.slice(0, available)
      chunk = chunk.slice(available)
    }
    if (chunk && tailLimit > 0) tail = `${tail}${chunk}`.slice(-tailLimit)
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      append(decoder.decode(value, { stream: true }))
    }
    append(decoder.decode())
  } finally {
    reader.releaseLock()
  }

  const omitted = total - head.length - tail.length
  if (omitted <= 0) return head + tail
  let marker = ""
  let payload = maximum
  for (let attempt = 0; attempt < 3; attempt += 1) {
    marker = `\n[... ${total - payload} characters omitted ...]\n`
    payload = Math.max(0, maximum - marker.length)
  }
  if (payload === 0) return head.slice(0, maximum)
  const keptHead = Math.ceil(payload / 2)
  const keptTail = Math.floor(payload / 2)
  const tailOutput = keptTail === 0 ? "" : tail.slice(-keptTail)
  return `${head.slice(0, keptHead)}${marker}${tailOutput}`
}

function signalProcessGroup(pid: number, signal: NodeJS.Signals) {
  try {
    if (process.platform === "win32") process.kill(pid, signal)
    else process.kill(-pid, signal)
    return true
  } catch (error) {
    if (["EPERM", "ESRCH"].includes((error as NodeJS.ErrnoException).code ?? "")) return false
    return false
  }
}

export class BunCommandRunner implements CommandRunner {
  async run(argv: string[], options: CommandOptions = {}): Promise<CommandResult> {
    const started = performance.now()
    if (
      options.timeoutMs !== undefined &&
      (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)
    ) {
      throw new Error("timeoutMs must be greater than zero")
    }
    if (options.signal?.aborted) {
      return {
        exitCode: 130,
        stdout: "",
        stderr: "command cancelled before it started",
        aborted: true,
        timedOut: false,
        durationMs: 0,
      }
    }

    const processHandle = Bun.spawn(argv, {
      cwd: options.cwd,
      detached: true,
      env: { ...process.env, ...options.env },
      stdin: options.stdin === undefined ? "ignore" : "pipe",
      stdout: "pipe",
      stderr: "pipe",
    })

    let settled = false
    let reason: "aborted" | "timeout" | undefined
    let escalation: Promise<void> | undefined
    const stop = (next: "aborted" | "timeout") => {
      if (reason || settled) return
      reason = next
      signalProcessGroup(processHandle.pid, "SIGTERM")
      escalation = Bun.sleep(TERMINATION_GRACE_MS).then(() => {
        signalProcessGroup(processHandle.pid, "SIGKILL")
      })
    }
    const onAbort = () => stop("aborted")
    options.signal?.addEventListener("abort", onAbort, { once: true })
    if (options.signal?.aborted) onAbort()
    const timeout = options.timeoutMs === undefined
      ? undefined
      : setTimeout(() => stop("timeout"), options.timeoutMs)

    const stdoutPromise = readOutput(processHandle.stdout, options.outputLimitCharacters)
    const stderrPromise = readOutput(processHandle.stderr, options.outputLimitCharacters)
    const exitPromise = processHandle.exited.then((exitCode) => {
      settled = true
      return exitCode
    })

    try {
      if (options.stdin !== undefined) {
        const stdin = processHandle.stdin
        if (!stdin || typeof stdin === "number") throw new Error("unable to open command stdin")
        stdin.write(options.stdin)
        stdin.end()
      }

      const [stdout, stderr, processExitCode] = await Promise.all([
        stdoutPromise,
        stderrPromise,
        exitPromise,
      ])
      await escalation
      return {
        exitCode: reason === "timeout" ? 124 : reason === "aborted" ? 130 : processExitCode,
        stdout,
        stderr,
        aborted: reason === "aborted",
        timedOut: reason === "timeout",
        durationMs: Math.round(performance.now() - started),
      }
    } catch (error) {
      stop("aborted")
      await Promise.allSettled([stdoutPromise, stderrPromise, exitPromise, escalation])
      throw error
    } finally {
      if (timeout !== undefined) clearTimeout(timeout)
      options.signal?.removeEventListener("abort", onAbort)
    }
  }
}

export async function checked(
  runner: CommandRunner,
  argv: string[],
  options?: CommandOptions,
) {
  const result = await runner.run(argv, options)
  if (result.exitCode !== 0) {
    throw new Error(`${argv[0]} failed (${result.exitCode}): ${result.stderr || result.stdout}`.trim())
  }
  return result
}
