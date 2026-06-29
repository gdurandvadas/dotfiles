declare const Bun: any;

import { tool } from "@opencode-ai/plugin";
import fs from "fs/promises";
import path from "path";
import { type StoreItem } from "./store-types.js";

export default tool({
  description:
    "Query and retrieve structured session memories. Supports two modes: LIST (discovery - returns summaries without heavy data) and READ (retrieval - returns full item with data field). Always prefer LIST mode first if unsure what IDs exist.",
  args: {
    id: tool.schema
      .string()
      .optional()
      .describe(
        "Optional: Specific item ID to retrieve (READ mode). Returns full item including data field. Omit for LIST mode.",
      ),
    tags: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe(
        "Optional: Filter by tags in LIST mode (AND logic - must match ALL tags). Example: ['auth', 'critical']",
      ),
  },
  async execute(args, context) {
    const file = path.join(
      process.cwd(),
      ".opencode",
      "sessions",
      "store.json",
    );

    try {
      const raw = await fs.readFile(file, "utf-8");
      try {
        const parsed = JSON.parse(raw);
        const items: StoreItem[] = Array.isArray(parsed) ? parsed : [];

        // READ MODE: Return full item with data
        if (args.id) {
          const found = items.find((it) => it.id === args.id);
          return JSON.stringify(
            { found: !!found, item: found ?? null },
            null,
            2,
          );
        }

        // LIST MODE: Return summaries only (lightweight)
        const list = items
          .filter((it) =>
            args.tags && args.tags.length > 0
              ? args.tags.every((t) => it.tags?.includes(t))
              : true,
          )
          .map((it) => ({
            id: it.id,
            summary: it.summary,
            tags: it.tags,
            status: it.status,
            links: it.links,
            createdAt: it.createdAt,
            updatedAt: it.updatedAt,
          }));

        return JSON.stringify({ list }, null, 2);
      } catch (err) {
        return JSON.stringify({ list: [] }, null, 2);
      }
    } catch (err) {
      return JSON.stringify({ list: [] }, null, 2);
    }
  },
});
