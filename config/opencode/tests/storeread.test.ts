import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs/promises";
import os from "os";
import path from "path";

import storereadTool from "../tools/storeread";

const ITEMS = [
  {
    id: "aaa-111",
    summary: "First item",
    tags: ["auth", "critical"],
    status: "active",
    data: { key: "value1" },
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
  },
  {
    id: "bbb-222",
    summary: "Second item",
    tags: ["database"],
    status: "archived",
    data: { key: "value2" },
    createdAt: "2024-01-03T00:00:00.000Z",
    updatedAt: "2024-01-04T00:00:00.000Z",
  },
];

const STORE_REL_PATH = path.join(".opencode", "sessions", "store.json");

let originalCwd: string;
let tmpDir: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "storeread-test-"));
  process.chdir(tmpDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

async function writeStoreFile(contents: string): Promise<void> {
  const storePath = path.join(tmpDir, STORE_REL_PATH);
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, contents, "utf-8");
}

async function writeStoreItems(items: typeof ITEMS): Promise<void> {
  await writeStoreFile(JSON.stringify(items, null, 2));
}

async function runTool(args: Parameters<typeof storereadTool.execute>[0]) {
  const raw = await storereadTool.execute(args, {} as any);
  return JSON.parse(raw);
}

describe("storeread tool", () => {
  describe("list mode", () => {
    test("returns empty list when store missing", async () => {
      const result = await runTool({ id: undefined });
      expect(result).toEqual({ list: [] });
    });

    test("returns empty list for invalid JSON", async () => {
      await writeStoreFile("not a json");
      const result = await runTool({});
      expect(result).toEqual({ list: [] });
    });

    test("returns all items when no filter", async () => {
      await writeStoreItems(ITEMS);
      const result = await runTool({});
      expect(result.list).toHaveLength(2);
      expect(result.list).toEqual([
        {
          id: "aaa-111",
          summary: "First item",
          tags: ["auth", "critical"],
          status: "active",
          links: undefined,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-02T00:00:00.000Z",
        },
        {
          id: "bbb-222",
          summary: "Second item",
          tags: ["database"],
          status: "archived",
          links: undefined,
          createdAt: "2024-01-03T00:00:00.000Z",
          updatedAt: "2024-01-04T00:00:00.000Z",
        },
      ]);
    });

    test("filters items by tags with AND logic", async () => {
      await writeStoreItems(ITEMS);
      const result = await runTool({ tags: ["auth", "critical"] });
      expect(result.list).toEqual([
        {
          id: "aaa-111",
          summary: "First item",
          tags: ["auth", "critical"],
          status: "active",
          links: undefined,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-02T00:00:00.000Z",
        },
      ]);
    });

    test("excludes items that do not match all tags", async () => {
      await writeStoreItems(ITEMS);
      const result = await runTool({ tags: ["auth", "database"] });
      expect(result.list).toEqual([]);
    });

    test("empty tags array returns all items", async () => {
      await writeStoreItems(ITEMS);
      const result = await runTool({ tags: [] });
      expect(result.list).toHaveLength(2);
    });

    test("list entries include expected summary fields without data", async () => {
      await writeStoreItems(ITEMS);
      const result = await runTool({});
      for (const item of result.list) {
        expect(item).toMatchObject({
          id: expect.any(String),
          summary: expect.any(String),
          tags: expect.any(Array),
          status: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        });
        expect(item).not.toHaveProperty("data");
      }
    });
  });

  describe("read mode", () => {
    test("returns item when id matches", async () => {
      await writeStoreItems(ITEMS);
      const result = await runTool({ id: "aaa-111" });
      expect(result).toEqual({ found: true, item: ITEMS[0] });
    });

    test("returns found false when id missing", async () => {
      await writeStoreItems(ITEMS);
      const result = await runTool({ id: "missing" });
      expect(result).toEqual({ found: false, item: null });
    });

    test("read mode returns full item with data field", async () => {
      await writeStoreItems(ITEMS);
      const result = await runTool({ id: "bbb-222" });
      expect(result.item).toHaveProperty("data");
      expect(result.item.data).toEqual({ key: "value2" });
    });
  });
});
