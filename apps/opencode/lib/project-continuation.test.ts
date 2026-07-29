import { describe, expect, test } from "bun:test";

import { decideContinuation } from "../plugins/project-continuation";

describe("Project continuation guard", () => {
  test("continues an active Project and resets stagnation after tool progress", () => {
    expect(decideContinuation({
      projectStatus: "active",
      assistantMode: "project",
      toolEpoch: 4,
      observedToolEpoch: 3,
      stagnantContinuations: 2,
    })).toEqual({ continue: true, stagnantContinuations: 0 });
  });

  test("does not continue waiting, completed, or non-Project sessions", () => {
    for (const input of [
      { projectStatus: "waiting", assistantMode: "project" },
      { projectStatus: "done", assistantMode: "project" },
      { projectStatus: "active", assistantMode: "default" },
    ]) {
      expect(decideContinuation({
        ...input,
        toolEpoch: 0,
        observedToolEpoch: 0,
        stagnantContinuations: 0,
      }).continue).toBe(false);
    }
  });

  test("stops after three consecutive tool-free Project continuations", () => {
    expect(decideContinuation({
      projectStatus: "active",
      assistantMode: "project",
      toolEpoch: 2,
      observedToolEpoch: 2,
      stagnantContinuations: 2,
    })).toEqual({ continue: false, stagnantContinuations: 3 });
  });
});
