import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import storedeleteTool from "../tools/storedelete";
import fs from "fs/promises";
import path from "path";
import os from "os";

const ITEMS = [
  {
    id: "aaa-111",
    summary: "Item A",
    tags: ["x"],
    status: "active",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "bbb-222",
    summary: "Item B",
    tags: ["y"],
    status: "active",
    createdAt: "2024-01-02T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
  },
];

const writeStore = async (dir: string, items: unknown[]) => {
  const p = path.join(dir, ".opencode", "sessions");
  await fs.mkdir(p, { recursive: true });
  await fs.writeFile(path.join(p, "store.json"), JSON.stringify(items, null, 2), "utf-8");
};

const readStore = async (dir: string) =>
  JSON.parse(
    await fs.readFile(path.join(dir, ".opencode", "sessions", "store.json"), "utf-8"),
  );

describe("storedelete tool", () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "storedelete-test-"));
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test("returns success when store file is missing", async () => {
    const id = "missing-id";
    const result = JSON.parse(await storedeleteTool.execute({ id }, {} as any));

    expect(result).toEqual({ success: true, id, deleted: false });
  });

  test("deletes the matching item and preserves others", async () => {
    await writeStore(tmpDir, ITEMS);

    const id = ITEMS[0].id;
    const result = JSON.parse(await storedeleteTool.execute({ id }, {} as any));

    expect(result).toEqual({ success: true, id, deleted: true });

    const updated = await readStore(tmpDir);
    expect(updated).toEqual([ITEMS[1]]);
  });

  test("returns success without modification when id not found", async () => {
    await writeStore(tmpDir, ITEMS);

    const id = "ccc-333";
    const before = await readStore(tmpDir);

    const result = JSON.parse(await storedeleteTool.execute({ id }, {} as any));

    expect(result).toEqual({ success: true, id, deleted: false });
    const after = await readStore(tmpDir);
    expect(after).toEqual(before);
  });

  test("returns error when store file is corrupted", async () => {
    const dir = path.join(tmpDir, ".opencode", "sessions");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "store.json"), "not-json", "utf-8");

    const id = "corrupt-id";
    const result = JSON.parse(await storedeleteTool.execute({ id }, {} as any));

    expect(result).toEqual({
      success: false,
      id,
      deleted: false,
      error: "Store file is corrupted",
    });
  });

  test("deleting the only item writes an empty array", async () => {
    await writeStore(tmpDir, [ITEMS[0]]);

    const id = ITEMS[0].id;
    const result = JSON.parse(await storedeleteTool.execute({ id }, {} as any));

    expect(result).toEqual({ success: true, id, deleted: true });

    const updated = await readStore(tmpDir);
    expect(updated).toEqual([]);
  });
});
