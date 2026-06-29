declare const Bun: any;

import { tool } from "@opencode-ai/plugin";
import fs from "fs/promises";
import path from "path";
import { type StoreItem, writeFile } from "./store-types.js";

export default tool({
  description:
    "Delete a stored item from the session store by ID. Permanently removes the item from store.json. Use this to clean up obsolete, completed, or incorrect store entries. Returns deleted=true if the item was found and removed, deleted=false if the ID was not found.",
  args: {
    id: tool.schema
      .string()
      .describe(
        "Required: UUID of the item to delete from the store",
      ),
  },
  async execute(args, context) {
    const { id } = args;
    const dir = path.join(process.cwd(), ".opencode", "sessions");
    const file = path.join(dir, "store.json");

    let items: StoreItem[] = [];
    let deleted = false;

    try {
      const raw = await fs.readFile(file, "utf-8");
      try {
        const parsedFile = JSON.parse(raw);
        if (Array.isArray(parsedFile)) items = parsedFile;
      } catch (err) {
        return JSON.stringify(
          {
            success: false,
            id,
            deleted: false,
            error: "Store file is corrupted",
          },
          null,
          2,
        );
      }
    } catch (err) {
      return JSON.stringify(
        {
          success: true,
          id,
          deleted: false,
        },
        null,
        2,
      );
    }

    const initialLength = items.length;
    const filteredItems = items.filter((item) => item.id !== id);
    deleted = filteredItems.length < initialLength;

    if (deleted) {
      try {
        await fs.mkdir(dir, { recursive: true });
        await writeFile(file, JSON.stringify(filteredItems, null, 2));
      } catch (err) {
        return JSON.stringify(
          {
            success: false,
            id,
            deleted: false,
            error: "Failed to write to store file",
          },
          null,
          2,
        );
      }
    }

    return JSON.stringify(
      {
        success: true,
        id,
        deleted,
      },
      null,
      2,
    );
  },
});
