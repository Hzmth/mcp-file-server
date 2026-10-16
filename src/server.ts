import { resolveSafe } from "./sandbox.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 3000);
const WORKSPACE = path.resolve(process.env.WORKSPACE_ROOT ?? "./workspace");

const text = (t: string): CallToolResult => ({ content: [{ type: "text", text: t }] });
const fail = (t: string): CallToolResult => ({ isError: true, content: [{ type: "text", text: t }] });
async function run(fn: () => Promise<string>): Promise<CallToolResult> {
  try { return text(await fn()); } catch (e) { return fail((e as Error).message); }
}
const MAX_READ = 100_000; // bytes

function buildServer() {
  const server = new McpServer({ name: "file-server", version: "0.1.0" });

  server.registerTool("list_files", {
    description: "List files and folders in a workspace directory. Folders end with '/'. Fails if the directory does not exist.",
    inputSchema: { dir: z.string().default(".") },
  }, ({ dir }) => run(async () => {
    const p = await resolveSafe(WORKSPACE, dir);
    const entries = await fs.readdir(p, { withFileTypes: true });
    return entries.map((e) => (e.isDirectory() ? e.name + "/" : e.name)).join("\n") || "(empty)";
  }));

  server.registerTool("read_file", {
    description: "Read a UTF-8 text file from the workspace. Fails if missing or larger than 100 KB; for big files, use search instead.",
    inputSchema: { path: z.string() },
  }, ({ path: filePath }) => run(async () => {
    const p = await resolveSafe(WORKSPACE, filePath);
    const st = await fs.stat(p);
    if (st.size > MAX_READ) throw new Error(`File is ${st.size} bytes, over the ${MAX_READ} limit.`);
    return await fs.readFile(p, "utf8");
  }));

  server.registerTool("write_file", {
    description: "Create or overwrite a file with the given content. Creates parent folders. Read the file first if it exists, because this replaces it entirely.",
    inputSchema: { path: z.string(), content: z.string() },
  }, ({ path: filePath, content }) => run(async () => {
    const p = await resolveSafe(WORKSPACE, filePath);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content, "utf8");
    return `Wrote ${content.length} characters to ${filePath}`;
  }));

  server.registerTool("str_replace", {
    description: "Replace one exact occurrence of old_str in a file. old_str must appear exactly once or the call fails, so include surrounding text to make it unique.",
    inputSchema: { path: z.string(), old_str: z.string().min(1), new_str: z.string() },
  }, ({ path: filePath, old_str, new_str }) => run(async () => {
    const p = await resolveSafe(WORKSPACE, filePath);
    const data = await fs.readFile(p, "utf8");
    const count = data.split(old_str).length - 1;
    if (count !== 1) throw new Error(`old_str matched ${count} times; it must match exactly once.`);
    await fs.writeFile(p, data.replace(old_str, () => new_str), "utf8");
    return `Replaced 1 occurrence in ${filePath}`;
  }));

  server.registerTool("delete_file", {
    description: "Delete one file (not a folder) from the workspace. Cannot be undone. Fails if the file does not exist.",
    inputSchema: { path: z.string() },
  }, ({ path: filePath }) => run(async () => {
    const p = await resolveSafe(WORKSPACE, filePath);
    await fs.unlink(p);
    return `Deleted ${filePath}`;
  }));

  return server;
}

const app = express();
app.use(express.json());

app.post("/mcp/:token", async (req, res) => {
  if (!process.env.AUTH_TOKEN || req.params.token !== process.env.AUTH_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, "127.0.0.1", () => console.log(`MCP server on http://127.0.0.1:${PORT}/mcp`));
