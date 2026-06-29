import fs from "fs/promises";

export type StoreItem = {
  id: string;
  summary: string;
  tags: string[];
  status?: "active" | "archived" | "deprecated";
  links?: string[];
  data?: unknown;
  updatedAt?: string;
  createdAt?: string;
};

// Use Bun APIs when available for performance, but fall back to fs/promises
declare const Bun: any;
export const writeFile: (p: string, data: string) => Promise<unknown> =
  typeof Bun !== "undefined" && Bun?.write
    ? (p: string, data: string) => Bun.write(Bun.file(p), data)
    : (p: string, data: string) => fs.writeFile(p, data, "utf-8");
