export type CommandOptions = {
  cwd?: string
  env?: Record<string, string>
  stdin?: string | Uint8Array
}

export type CommandResult = {
  exitCode: number
  stdout: string
  stderr: string
}

export interface CommandRunner {
  run(argv: string[], options?: CommandOptions): Promise<CommandResult>
}

export class BunCommandRunner implements CommandRunner {
  async run(argv: string[], options: CommandOptions = {}): Promise<CommandResult> {
    const processHandle = Bun.spawn(argv, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdin: options.stdin === undefined ? "ignore" : "pipe",
      stdout: "pipe",
      stderr: "pipe",
    })

    if (options.stdin !== undefined) {
      const stdin = processHandle.stdin
      if (!stdin || typeof stdin === "number") throw new Error("unable to open command stdin")
      stdin.write(options.stdin)
      stdin.end()
    }

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(processHandle.stdout).text(),
      new Response(processHandle.stderr).text(),
      processHandle.exited,
    ])
    return { exitCode, stdout, stderr }
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
