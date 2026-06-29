import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import storewriteTool from "../tools/storewrite";
import fs from "fs/promises";
import os from "os";
import path from "path";

const readStore = async (dir: string) =>
  JSON.parse(
    await fs.readFile(path.join(dir, ".opencode", "sessions", "store.json"), "utf-8"),
  );

describe("storewrite tool", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "storewrite-test-"));
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test("creates store file and returns success with auto-generated uuid", async () => {
    const response = await storewriteTool.execute(
      { summary: "capture context", tags: ["test"] },
      {} as any,
    );

    const parsed = JSON.parse(response);
    expect(parsed.success).toBe(true);
    expect(parsed.id).toMatch(/^[0-9a-f-]{36}$/);

    const store = await readStore(tmpDir);
    expect(store).toHaveLength(1);
    expect(store[0].id).toBe(parsed.id);
  });

  test("written item has summary, tags, default status, createdAt, and updatedAt", async () => {
    const tags = ["alpha", "beta"];
    await storewriteTool.execute({ summary: "detail", tags }, {} as any);

    const [item] = await readStore(tmpDir);
    expect(item.summary).toBe("detail");
    expect(item.tags).toEqual(tags);
    expect(item.status).toBe("active");
    expect(typeof item.createdAt).toBe("string");
    expect(typeof item.updatedAt).toBe("string");
    expect(item.createdAt).toBe(item.updatedAt);
  });

  test("written item includes data when provided", async () => {
    const payload = { foo: "bar", nested: { count: 3 } };
    await storewriteTool.execute(
      { summary: "data", tags: ["payload"], data: payload },
      {} as any,
    );

    const [item] = await readStore(tmpDir);
    expect(item.data).toEqual(payload);
  });

  test("written item includes links when provided", async () => {
    const links = ["https://example.com/reference"];
    await storewriteTool.execute(
      { summary: "link", tags: ["refs"], links },
      {} as any,
    );

    const [item] = await readStore(tmpDir);
    expect(item.links).toEqual(links);
  });

  test("merges existing item while preserving createdAt", async () => {
    const id = "existing-item";
    await storewriteTool.execute(
      { id, summary: "initial", tags: ["one"], status: "active" },
      {} as any,
    );

    const [first] = await readStore(tmpDir);
    const { createdAt, updatedAt: originalUpdatedAt } = first;

    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    await storewriteTool.execute(
      { id, summary: "updated", tags: ["two"], status: "archived" },
      {} as any,
    );

    const [merged] = await readStore(tmpDir);
    expect(merged.createdAt).toBe(createdAt);
    expect(merged.summary).toBe("updated");
    expect(merged.tags).toEqual(["two"]);
    expect(merged.status).toBe("archived");
    expect(merged.updatedAt).not.toBe(originalUpdatedAt);
    expect((await readStore(tmpDir))).toHaveLength(1);
  });

  test("writing two items stores both", async () => {
    await storewriteTool.execute(
      { id: "first", summary: "one", tags: ["1"] },
      {} as any,
    );
    await storewriteTool.execute(
      { id: "second", summary: "two", tags: ["2"] },
      {} as any,
    );

    const store = await readStore(tmpDir);
    expect(store).toHaveLength(2);
    expect(store.map((item: any) => item.id).sort()).toEqual(["first", "second"]);
  });

  test("writing with explicit id stores item at that id", async () => {
    const explicitId = "custom-id-value";
    await storewriteTool.execute(
      { id: explicitId, summary: "explicit", tags: ["custom"] },
      {} as any,
    );

    const [item] = await readStore(tmpDir);
    expect(item.id).toBe(explicitId);
  });

  test("corrupt store file is backed up and replaced", async () => {
    const sessionsDir = path.join(tmpDir, ".opencode", "sessions");
    await fs.mkdir(sessionsDir, { recursive: true });
    const file = path.join(sessionsDir, "store.json");
    await fs.writeFile(file, "not valid json", "utf-8");

    await storewriteTool.execute({ summary: "reset", tags: ["drop"] }, {} as any);

    const store = await readStore(tmpDir);
    expect(store).toHaveLength(1);

    const backup = await fs.readFile(file + ".bak", "utf-8");
    expect(backup).toBe("not valid json");
  });

  test("empty store array is replaced with new item", async () => {
    const sessionsDir = path.join(tmpDir, ".opencode", "sessions");
    await fs.mkdir(sessionsDir, { recursive: true });
    const file = path.join(sessionsDir, "store.json");
    await fs.writeFile(file, "[]", "utf-8");

    await storewriteTool.execute({ summary: "array", tags: ["empty"] }, {} as any);

    const store = await readStore(tmpDir);
    expect(store).toHaveLength(1);
  });
});
