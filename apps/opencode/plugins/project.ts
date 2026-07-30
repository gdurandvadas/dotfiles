import { Plugin } from "@opencode-ai/plugin";
import {
  approveProject,
  commitProject,
  ProjectOperationError,
  publishProject,
  sessionProjectID,
  startProject,
} from "../lib/project.js";

const stringProperty = { type: "string", minLength: 1 } as const;

function textResult(value: unknown) {
  return {
    content: JSON.stringify(value, null, 2),
  };
}

function toolFailure(error: unknown): never {
  if (error instanceof ProjectOperationError) {
    throw new Error(`${error.code}: ${error.message}`);
  }
  throw error;
}

export default Plugin.define({
  id: "personal.ade-project",
  setup: async (ctx) => {
    const directoryFor = async (sessionID: string) => {
      const session = await ctx.session.get({ sessionID: sessionID as never });
      return String(session.location.directory);
    };

    await ctx.tool.transform((tools) => {
      tools.add({
        name: "project_start",
        description:
          "Prepare the remote default branch, preserve current changes, create a unique project branch, and scaffold living project documents.",
        input: {
          type: "object",
          properties: { title: stringProperty },
          required: ["title"],
          additionalProperties: false,
        },
        options: { codemode: false, permission: "project_start" },
        execute: async (input, context) => {
          try {
            const { title } = input as { title: string };
            const result = startProject(await directoryFor(String(context.sessionID)), title);
            return textResult({
              project_id: result.id,
              title: result.title,
              base_branch: result.baseBranch,
              branch: result.branch,
              project_directory: result.projectDirectory,
              carried_changes: result.carriedChanges,
              next_action: "Delegate repository research to ade-researcher.",
            });
          } catch (error) {
            return toolFailure(error);
          }
        },
      });

      tools.add({
        name: "project_current",
        description: "Resolve the active project id from the current project/* branch.",
        input: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        options: { codemode: false, permission: "project_current" },
        execute: async (_input, context) => {
          try {
            const id = sessionProjectID(await directoryFor(String(context.sessionID)));
            return textResult({
              project_id: id ?? null,
              next_action: id
                ? `Read .projects/${id}/plan.md, changes.md, and result.md.`
                : "Run /project with a non-empty title to create a project.",
            });
          } catch (error) {
            return toolFailure(error);
          }
        },
      });

      tools.add({
        name: "project_approve",
        description:
          "Record explicit user approval by changing the active project's plan metadata from draft to approved.",
        input: {
          type: "object",
          properties: { id: stringProperty },
          required: ["id"],
          additionalProperties: false,
        },
        options: { codemode: false, permission: "project_approve" },
        execute: async (input, context) => {
          try {
            const { id } = input as { id: string };
            const path = approveProject(await directoryFor(String(context.sessionID)), id);
            return textResult({
              project_id: id,
              status: "approved",
              plan: path,
              next_action: "Select and execute the first pending task.",
            });
          } catch (error) {
            return toolFailure(error);
          }
        },
      });

      tools.add({
        name: "project_commit",
        description:
          "Create one semantic commit for an approved and validated milestone using only explicit safe paths.",
        input: {
          type: "object",
          properties: {
            id: stringProperty,
            milestone: stringProperty,
            paths: {
              type: "array",
              minItems: 1,
              items: stringProperty,
            },
            type: {
              type: "string",
              enum: [
                "build",
                "chore",
                "ci",
                "docs",
                "feat",
                "fix",
                "perf",
                "refactor",
                "revert",
                "style",
                "test",
              ],
            },
            summary: stringProperty,
          },
          required: ["id", "milestone", "paths", "type", "summary"],
          additionalProperties: false,
        },
        options: { codemode: false, permission: "project_commit" },
        execute: async (input, context) => {
          try {
            const args = input as {
              id: string;
              milestone: string;
              paths: string[];
              type: string;
              summary: string;
            };
            return textResult(
              commitProject(await directoryFor(String(context.sessionID)), args),
            );
          } catch (error) {
            return toolFailure(error);
          }
        },
      });

      tools.add({
        name: "project_publish",
        description:
          "Push a clean completed project branch and create or return its GitHub draft pull request.",
        input: {
          type: "object",
          properties: {
            id: stringProperty,
            title: stringProperty,
            body: stringProperty,
          },
          required: ["id", "title", "body"],
          additionalProperties: false,
        },
        options: { codemode: false, permission: "project_publish" },
        execute: async (input, context) => {
          try {
            const args = input as { id: string; title: string; body: string };
            return textResult(
              publishProject(await directoryFor(String(context.sessionID)), args),
            );
          } catch (error) {
            return toolFailure(error);
          }
        },
      });
    });
  },
});
