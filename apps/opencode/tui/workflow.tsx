/** @jsxImportSource @opentui/solid */
import { onCleanup } from "solid-js"
import type { TuiPlugin, TuiPluginApi, TuiPluginModule, TuiSlotPlugin } from "@opencode-ai/plugin/tui"
import { createBindingLookup } from "@opencode-ai/plugin/tui"
import { readStates, type MilestoneState } from "../lib/workflow.ts"

const routeName = "workflow.dashboard"
const modeName = "workflow.dashboard"

const command = {
  open: "workflow.open",
  close: "workflow.close",
  refresh: "workflow.refresh",
  select: "workflow.select",
  plan: "workflow.plan",
  run: "workflow.run",
  audit: "workflow.audit",
  status: "workflow.status",
}

const defaultKeys = {
  [command.open]: "<leader>w",
  [command.close]: "escape,q",
  [command.refresh]: "r",
  [command.select]: "m",
  [command.plan]: "p",
  [command.run]: "enter,x",
  [command.audit]: "a",
  [command.status]: "s",
}

type Params = {
  slug?: string
  returnSession?: string
  revision: number
}

function params(value: Record<string, unknown> | undefined): Params {
  return {
    slug: typeof value?.slug === "string" ? value.slug : undefined,
    returnSession: typeof value?.returnSession === "string" ? value.returnSession : undefined,
    revision: typeof value?.revision === "number" ? value.revision : 0,
  }
}

function currentParams(api: TuiPluginApi) {
  const route = api.route.current
  if (route.name !== routeName || !("params" in route)) return params(undefined)
  return params(route.params)
}

function root(api: TuiPluginApi) {
  const worktree = api.state.path.worktree
  return worktree && worktree !== "/" ? worktree : api.state.path.directory
}

function states(api: TuiPluginApi) {
  try {
    return { items: readStates(root(api)), error: undefined as string | undefined }
  } catch (error) {
    return { items: [] as MilestoneState[], error: error instanceof Error ? error.message : String(error) }
  }
}

function active(items: MilestoneState[], slug?: string) {
  return (slug ? items.find((item) => item.contract.slug === slug) : undefined) ?? items[0]
}

function tone(api: TuiPluginApi) {
  return api.theme.current
}

function Progress(props: { value: number; total: number; api: TuiPluginApi; width?: number }) {
  const skin = tone(props.api)
  const width = props.width ?? 24
  const fill = props.total === 0 ? 0 : Math.round((props.value / props.total) * width)
  return (
    <text fg={skin.textMuted}>
      <span style={{ fg: skin.success }}>{"━".repeat(fill)}</span>
      <span style={{ fg: skin.border }}>{"━".repeat(width - fill)}</span> {props.value}/{props.total}
    </text>
  )
}

function Empty(props: { api: TuiPluginApi; error?: string }) {
  const skin = tone(props.api)
  return (
    <box width="100%" height="100%" alignItems="center" justifyContent="center" flexDirection="column" gap={1}>
      <text fg={skin.primary}>
        <b>WAVEBOARD</b>
      </text>
      <text fg={props.error ? skin.error : skin.text}>No readable milestone contract</text>
      <text fg={skin.textMuted}>{props.error ?? "Press p to plan a milestone, or q to return."}</text>
    </box>
  )
}

function TaskCard(props: { state: MilestoneState; taskId: string; api: TuiPluginApi }) {
  const skin = tone(props.api)
  const task = props.state.contract.tasks.find((candidate) => candidate.id === props.taskId)
  if (!task) return null
  return (
    <box flexDirection="column" paddingBottom={1}>
      <text fg={skin.text}>
        <span style={{ fg: skin.primary }}>◆</span> <b>{task.id}</b> {task.title}
      </text>
      <text fg={skin.textMuted}>  {task.agent} · depends {task.dependencies.join(", ") || "none"}</text>
      <text fg={skin.textMuted}>  {task.acceptance}</text>
    </box>
  )
}

function Dashboard(props: { api: TuiPluginApi; routeParams?: Record<string, unknown> }) {
  const popMode = props.api.mode.push(modeName)
  onCleanup(popMode)
  const input = params(props.routeParams)
  const result = states(props.api)
  const selected = active(result.items, input.slug)
  const skin = tone(props.api)

  if (!selected) return <Empty api={props.api} error={result.error} />

  const completed = new Set(selected.checkpoints.map((checkpoint) => checkpoint.wave))
  const ready = selected.currentWave?.number
  const percent = Math.round((selected.checkpoints.length / selected.contract.waves.length) * 100)

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={skin.background}>
      <box
        flexShrink={0}
        flexDirection="row"
        justifyContent="space-between"
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        backgroundColor={skin.backgroundPanel}
      >
        <box flexDirection="column">
          <text fg={skin.primary}>
            <b>WAVEBOARD</b> <span style={{ fg: skin.textMuted }}>document-driven delivery</span>
          </text>
          <text fg={skin.text}>
            <b>{selected.contract.title}</b> <span style={{ fg: skin.textMuted }}>{selected.contract.slug}</span>
          </text>
        </box>
        <box flexDirection="column" alignItems="flex-end">
          <text fg={selected.completed ? skin.success : skin.warning}>
            <b>{selected.completed ? "MILESTONE ACCEPTED" : `WAVE ${ready} READY`}</b>
          </text>
          <text fg={skin.textMuted}>{percent}% checkpointed</text>
        </box>
      </box>

      <box flexGrow={1} flexDirection="row" padding={1} gap={1}>
        <box
          width="25%"
          border
          borderColor={skin.border}
          backgroundColor={skin.backgroundPanel}
          padding={1}
          flexDirection="column"
          gap={1}
        >
          <text fg={skin.textMuted}>MILESTONES</text>
          {result.items.map((item) => (
            <box flexDirection="column" paddingBottom={1}>
              <text fg={item.contract.slug === selected.contract.slug ? skin.primary : skin.text}>
                {item.contract.slug === selected.contract.slug ? "●" : "○"} {item.contract.title}
              </text>
              <text fg={skin.textMuted}>
                {item.checkpoints.length}/{item.contract.waves.length} waves · {item.contract.tasks.length} tasks
              </text>
            </box>
          ))}
          <box flexGrow={1} />
          <text fg={skin.textMuted}>m choose · p new</text>
        </box>

        <box
          width="30%"
          border
          borderColor={skin.border}
          backgroundColor={skin.backgroundPanel}
          padding={1}
          flexDirection="column"
          gap={1}
        >
          <text fg={skin.textMuted}>EXECUTION CONTRACT</text>
          <Progress
            value={selected.checkpoints.length}
            total={selected.contract.waves.length}
            api={props.api}
            width={18}
          />
          {selected.contract.waves.map((wave) => {
            const status = completed.has(wave.number) ? "accepted" : wave.number === ready ? "ready" : "locked"
            const color = status === "accepted" ? skin.success : status === "ready" ? skin.warning : skin.textMuted
            return (
              <box flexDirection="column" paddingBottom={1}>
                <text fg={color}>
                  {status === "accepted" ? "✓" : status === "ready" ? "▶" : "◇"} <b>Wave {wave.number}</b> · {status}
                </text>
                <text fg={skin.textMuted}>  {wave.taskIds.join("  ")}</text>
              </box>
            )
          })}
          <box flexGrow={1} />
          <text fg={skin.textMuted}>{selected.planPath}</text>
        </box>

        <box
          flexGrow={1}
          border
          borderColor={ready ? skin.warning : skin.success}
          backgroundColor={skin.backgroundPanel}
          padding={1}
          flexDirection="column"
          gap={1}
        >
          <text fg={skin.textMuted}>{selected.completed ? "PRODUCT OUTCOME" : `READY NOW · WAVE ${ready}`}</text>
          <text fg={skin.text}>{selected.contract.objective}</text>
          <box paddingTop={1} flexDirection="column">
            {(selected.currentWave?.taskIds ?? []).map((taskId) => (
              <TaskCard state={selected} taskId={taskId} api={props.api} />
            ))}
          </box>
          {selected.completed && (
            <box flexDirection="column" gap={1}>
              <text fg={skin.success}>All checkpoint ADRs accepted.</text>
              {selected.contract.acceptance.map((criterion) => (
                <text fg={skin.text}>✓ {criterion}</text>
              ))}
            </box>
          )}
          <box flexGrow={1} />
          <text fg={skin.textMuted}>
            <span style={{ fg: skin.primary }}>enter</span> execute ·{" "}
            <span style={{ fg: skin.primary }}>a</span> audit · <span style={{ fg: skin.primary }}>s</span> status ·{" "}
            <span style={{ fg: skin.primary }}>r</span> refresh ·{" "}
            <span style={{ fg: skin.primary }}>q</span> close
          </text>
        </box>
      </box>
    </box>
  )
}

function goBack(api: TuiPluginApi) {
  const input = currentParams(api)
  if (input.returnSession) api.route.navigate("session", { sessionID: input.returnSession })
  else api.route.navigate("home")
}

async function submit(api: TuiPluginApi, text: string) {
  goBack(api)
  await api.client.tui.appendPrompt({ text })
  await api.client.tui.submitPrompt()
}

function selectMilestone(api: TuiPluginApi) {
  const result = states(api)
  if (result.items.length === 0) {
    api.ui.toast({ variant: "warning", title: "Waveboard", message: "No milestone contracts found" })
    return
  }
  const DialogSelect = api.ui.DialogSelect
  const input = currentParams(api)
  api.ui.dialog.setSize("medium")
  api.ui.dialog.replace(() => (
    <DialogSelect
      title="Choose milestone"
      current={input.slug ?? result.items[0]?.contract.slug}
      options={result.items.map((item) => ({
        title: item.contract.title,
        value: item.contract.slug,
        description: `${item.checkpoints.length}/${item.contract.waves.length} waves · ${item.contract.slug}`,
      }))}
      onSelect={(item) => {
        api.ui.dialog.clear()
        api.route.navigate(routeName, { ...input, slug: item.value, revision: Date.now() })
      }}
    />
  ))
}

function newMilestone(api: TuiPluginApi) {
  const DialogPrompt = api.ui.DialogPrompt
  api.ui.dialog.setSize("large")
  api.ui.dialog.replace(() => (
    <DialogPrompt
      title="Plan a milestone"
      placeholder="Describe the product outcome…"
      description={() => <text fg={tone(api).textMuted}>The Plan agent will research and seal an immutable DAG.</text>}
      onConfirm={(value) => {
        api.ui.dialog.clear()
        if (value.trim()) void submit(api, `/milestone-plan ${value.trim()}`)
      }}
      onCancel={() => api.ui.dialog.clear()}
    />
  ))
}

function open(api: TuiPluginApi) {
  const route = api.route.current
  const returnSession = route.name === "session" ? route.params?.sessionID : undefined
  const current = states(api).items[0]
  api.route.navigate(routeName, { slug: current?.contract.slug, returnSession, revision: Date.now() })
}

function sidebar(api: TuiPluginApi): TuiSlotPlugin {
  return {
    order: 240,
    slots: {
      sidebar_content(ctx) {
        const result = states(api)
        const item = result.items[0]
        if (!item) return null
        const skin = ctx.theme.current
        return (
          <box border borderColor={skin.border} padding={1} flexDirection="column" gap={1}>
            <text fg={skin.primary}>
              <b>WAVEBOARD</b>
            </text>
            <text fg={skin.text}>{item.contract.title}</text>
            <Progress value={item.checkpoints.length} total={item.contract.waves.length} api={api} width={16} />
            <text fg={item.completed ? skin.success : skin.warning}>
              {item.completed ? "✓ accepted" : `▶ wave ${item.currentWave?.number} ready`}
            </text>
          </box>
        )
      },
    },
  }
}

const tui: TuiPlugin = async (api, options) => {
  const configuredKey = typeof options?.keybind === "string" ? options.keybind : defaultKeys[command.open]
  const keys = createBindingLookup({ ...defaultKeys, [command.open]: configuredKey })

  api.route.register([
    {
      name: routeName,
      render: ({ params: routeParams }) => <Dashboard api={api} routeParams={routeParams} />,
    },
  ])

  api.keymap.registerLayer({
    mode: "base",
    commands: [
      {
        name: command.open,
        title: "Open Waveboard",
        category: "Workflow",
        namespace: "palette",
        slashName: "waves",
        suggested: true,
        run: () => open(api),
      },
    ],
    bindings: keys.gather("workflow.global", [command.open]),
  })

  api.keymap.registerLayer({
    mode: modeName,
    commands: [
      { name: command.close, run: () => goBack(api) },
      {
        name: command.refresh,
        run: () => api.route.navigate(routeName, { ...currentParams(api), revision: Date.now() }),
      },
      { name: command.select, run: () => selectMilestone(api) },
      { name: command.plan, run: () => newMilestone(api) },
      {
        name: command.run,
        run: () => {
          const input = currentParams(api)
          if (input.slug) void submit(api, `/milestone-run ${input.slug}`)
        },
      },
      {
        name: command.audit,
        run: () => {
          const input = currentParams(api)
          if (input.slug) void submit(api, `/milestone-audit ${input.slug}`)
        },
      },
      {
        name: command.status,
        run: () => {
          const input = currentParams(api)
          if (input.slug) void submit(api, `/milestone-status ${input.slug}`)
        },
      },
    ],
    bindings: keys.gather("workflow.dashboard", [
      command.close,
      command.refresh,
      command.select,
      command.plan,
      command.run,
      command.audit,
      command.status,
    ]),
  })

  api.event.on("file.watcher.updated", (event) => {
    const path = JSON.stringify(event.properties).replaceAll("\\", "/")
    if (!path.includes(".opencode/plans") && !path.includes("docs/decisions")) return
    if (api.route.current.name === routeName) {
      api.route.navigate(routeName, { ...currentParams(api), revision: Date.now() })
    }
  })

  api.slots.register(sidebar(api))
}

const plugin: TuiPluginModule & { id: string } = {
  id: "personal.waveboard",
  tui,
}

export default plugin
