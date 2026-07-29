import type { Plugin } from "@opencode-ai/plugin";
import { execFileSync } from "node:child_process";

import { readProjectStatus } from "../lib/project";

const MAX_STAGNANT_CONTINUATIONS = 3;

interface SessionProgress {
  toolEpoch: number;
  observedToolEpoch: number;
  stagnantContinuations: number;
  prompting: boolean;
}

interface ContinuationDecision {
  continue: boolean;
  stagnantContinuations: number;
}

export function decideContinuation(input: {
  projectStatus: string;
  assistantMode?: string;
  toolEpoch: number;
  observedToolEpoch: number;
  stagnantContinuations: number;
}): ContinuationDecision {
  if (input.projectStatus !== "active" || input.assistantMode !== "project") {
    return { continue: false, stagnantContinuations: 0 };
  }
  const stagnantContinuations = input.toolEpoch === input.observedToolEpoch
    ? input.stagnantContinuations + 1
    : 0;
  return {
    continue: stagnantContinuations < MAX_STAGNANT_CONTINUATIONS,
    stagnantContinuations,
  };
}

function resultData<T>(result: unknown): T | undefined {
  if (!result || typeof result !== "object" || !("data" in result)) return undefined;
  return (result as { data?: T }).data;
}

function projectId(directory: string): string | undefined {
  try {
    const branch = execFileSync(
      "git",
      ["-C", directory, "branch", "--show-current"],
      { encoding: "utf8" },
    ).trim();
    return branch.startsWith("project/") ? branch.slice("project/".length) : undefined;
  } catch {
    return undefined;
  }
}

export const ProjectContinuationPlugin: Plugin = async ({ client, directory }) => {
  const progress = new Map<string, SessionProgress>();

  return {
    "tool.execute.after": async ({ sessionID }) => {
      const current = progress.get(sessionID) ?? {
        toolEpoch: 0,
        observedToolEpoch: -1,
        stagnantContinuations: 0,
        prompting: false,
      };
      current.toolEpoch += 1;
      progress.set(sessionID, current);
    },
    event: async ({ event }) => {
      if (event.type !== "session.idle") return;
      const sessionID = event.properties.sessionID;
      const current = progress.get(sessionID) ?? {
        toolEpoch: 0,
        observedToolEpoch: -1,
        stagnantContinuations: 0,
        prompting: false,
      };
      if (current.prompting) return;

      const sessionResult = await client.session.get({
        path: { id: sessionID },
        query: { directory },
      });
      const session = resultData<{ directory: string }>(sessionResult);
      if (!session) return;
      const id = projectId(session.directory);
      if (!id) return;

      let status;
      try {
        status = readProjectStatus(session.directory, id);
      } catch {
        return;
      }
      const messagesResult = await client.session.messages({
        path: { id: sessionID },
        query: { directory: session.directory, limit: 20 },
      });
      const messages = resultData<Array<{
        info: { role: string; mode?: string };
      }>>(messagesResult) ?? [];
      const assistant = messages.findLast((message) => message.info.role === "assistant");
      const decision = decideContinuation({
        projectStatus: status.status,
        assistantMode: assistant?.info.mode,
        toolEpoch: current.toolEpoch,
        observedToolEpoch: current.observedToolEpoch,
        stagnantContinuations: current.stagnantContinuations,
      });
      current.observedToolEpoch = current.toolEpoch;
      current.stagnantContinuations = decision.stagnantContinuations;
      progress.set(sessionID, current);
      if (!decision.continue) {
        if (
          status.status === "active" &&
          assistant?.info.mode === "project" &&
          decision.stagnantContinuations >= MAX_STAGNANT_CONTINUATIONS
        ) {
          await client.tui.showToast({
            body: {
              title: "Project needs attention",
              message:
                "Auto-continuation stopped after three Project turns without a tool action.",
              variant: "warning",
              duration: 8000,
            },
            query: { directory: session.directory },
          });
        }
        return;
      }

      current.prompting = true;
      try {
        await client.session.promptAsync({
          path: { id: sessionID },
          query: { directory: session.directory },
          body: {
            agent: "project",
            parts: [{
              type: "text",
              synthetic: true,
              text:
                `Continue the active Project now. Deterministic next action: ${status.next_action}. ` +
                "Do not end with a status-only or future-tense response. Execute the next in-scope " +
                "tool action, or record a genuine waiting boundary in Project state.",
            }],
          },
        });
      } finally {
        current.prompting = false;
      }
    },
  };
};
