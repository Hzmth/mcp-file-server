import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { resolveSafe } from "./sandbox.js";

const execFileP = promisify(execFile);
const PORT = Number(process.env.PORT ?? 3000);
const WORKSPACE = path.resolve(process.env.WORKSPACE_ROOT ?? "./workspace");
const LOG_FILE = path.resolve(WORKSPACE, "..", "logs", "calls.log");
const MAX_READ = 100_000; // bytes
const MAX_WRITE = 200_000; // characters
const PROTECTED = ["PROJECT_STATE.md", "PLAN_LOG.md", "CHECKPOINTS.md", "DECISIONS.md"];

const text = (t: string): CallToolResult => ({ content: [{ type: "text", text: t }] });
const fail = (t: string): CallToolResult => ({ isError: true, content: [{ type: "text", text: t }] });

// One line per call: time, tool, what it touched, outcome.
async function logCall(tool: string, detail: string, outcome: string) {
  try {
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    await fs.appendFile(LOG_FILE, `${new Date().toISOString()}\t${tool}\t${detail}\t${outcome}\n`);
  } catch {
    /* logging must never break a tool */
  }
}

async function run(tool: string, detail: string, fn: () => Promise<string>): Promise<CallToolResult> {
  try {
    const out = await fn();
    await logCall(tool, detail, "ok");
    return text(out);
  } catch (e) {
    const msg = (e as Error).message;
    await logCall(tool, detail, "error: " + msg);
    return fail(msg);
  }
}

// Sandbox check plus a block on the .git folder.
async function safePath(userPath: string): Promise<string> {
  const p = await resolveSafe(WORKSPACE, userPath);
  const rel = path.relative(await fs.realpath(WORKSPACE), p);
  if (rel.split(path.sep)[0] === ".git") throw new Error("The .git folder is off limits. Use the git_* tools.");
  return p;
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === "node_modules") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.isFile()) yield full; // symlinks are skipped on purpose
  }
}

// Run git inside the workspace repo. execFile with an argument list: no shell, no injection.
async function git(...args: string[]): Promise<string> {
  try {
    await fs.access(path.join(WORKSPACE, ".git"));
  } catch {
    throw new Error("The workspace is not a git repo. Run 'git init' inside the workspace folder.");
  }
  try {
    const { stdout, stderr } = await execFileP("git", ["-C", WORKSPACE, ...args], { timeout: 15000 });
    return (stdout + stderr).trim();
  } catch (e: any) {
    throw new Error(((e.stdout ?? "") + (e.stderr ?? "")).trim() || e.message);
  }
}

function buildServer() {
  const server = new McpServer({ name: "file-server", version: "0.2.0" });

  server.registerTool("list_files", {
    description: "List files and folders in a workspace directory. Folders end with '/'. Fails if the directory does not exist.",
    inputSchema: { dir: z.string().default(".") },
  }, ({ dir }) => run("list_files", dir, async () => {
    const p = await safePath(dir);
    const entries = await fs.readdir(p, { withFileTypes: true });
    return entries.map((e) => (e.isDirectory() ? e.name + "/" : e.name)).join("\n") || "(empty)";
  }));

  server.registerTool("read_file", {
    description: "Read a UTF-8 text file from the workspace. Fails if missing or larger than 100 KB; for big files use search_files to find the part you need.",
    inputSchema: { path: z.string() },
  }, ({ path: filePath }) => run("read_file", filePath, async () => {
    const p = await safePath(filePath);
    const st = await fs.stat(p);
    if (st.size > MAX_READ) throw new Error(`File is ${st.size} bytes, over the ${MAX_READ} limit. Use search_files instead.`);
    return await fs.readFile(p, "utf8");
  }));

  server.registerTool("write_file", {
    description: "Create or overwrite a file with the given content (max 200,000 characters). Creates parent folders. This replaces the whole file, so read it first if it exists; for small changes use str_replace.",
    inputSchema: { path: z.string(), content: z.string() },
  }, ({ path: filePath, content }) => run("write_file", filePath, async () => {
    if (content.length > MAX_WRITE) throw new Error(`Content is ${content.length} characters, over the ${MAX_WRITE} limit. Split it into several files.`);
    const p = await safePath(filePath);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content, "utf8");
    return `Wrote ${content.length} characters to ${filePath}`;
  }));

  server.registerTool("str_replace", {
    description: "Replace one exact occurrence of old_str in a file. old_str must appear exactly once or the call fails, so include surrounding text to make it unique. Read the file first.",
    inputSchema: { path: z.string(), old_str: z.string().min(1), new_str: z.string() },
  }, ({ path: filePath, old_str, new_str }) => run("str_replace", filePath, async () => {
    const p = await safePath(filePath);
    const data = await fs.readFile(p, "utf8");
    const count = data.split(old_str).length - 1;
    if (count !== 1) throw new Error(`old_str matched ${count} times; it must match exactly once.`);
    const updated = data.replace(old_str, () => new_str);
    if (updated.length > MAX_WRITE) throw new Error(`Result would be over the ${MAX_WRITE} character limit.`);
    await fs.writeFile(p, updated, "utf8");
    return `Replaced 1 occurrence in ${filePath}`;
  }));

  server.registerTool("delete_file", {
    description: "Permanently delete one file (not a folder). Requires confirm=true. Cannot be undone. The four handoff files (PROJECT_STATE, PLAN_LOG, CHECKPOINTS, DECISIONS) cannot be deleted. Fails if the file does not exist.",
    inputSchema: { path: z.string(), confirm: z.boolean().describe("Must be true to proceed") },
  }, ({ path: filePath, confirm }) => run("delete_file", filePath, async () => {
    if (confirm !== true) throw new Error("Deletion not confirmed. Call again with confirm=true if you are sure.");
    const p = await safePath(filePath);
    const rel = path.relative(await fs.realpath(WORKSPACE), p);
    if (PROTECTED.includes(rel)) throw new Error(`${rel} is a handoff file and cannot be deleted. Edit it instead.`);
    await fs.unlink(p);
    return `Deleted ${filePath}`;
  }));

  server.registerTool("search_files", {
    description: "Search workspace text files for a case-insensitive substring. Returns up to 20 matches as 'file:line: text'. Use this instead of reading whole files to find where something is. Skips binary and large files.",
    inputSchema: { query: z.string().min(1), dir: z.string().default(".") },
  }, ({ query, dir }) => run("search_files", `${dir} :: ${query}`, async () => {
    const start = await safePath(dir);
    const root = await fs.realpath(WORKSPACE);
    const q = query.toLowerCase();
    const hits: string[] = [];
    for await (const file of walk(start)) {
      const st = await fs.stat(file);
      if (st.size > MAX_READ) continue;
      const content = await fs.readFile(file, "utf8");
      if (content.includes("\0")) continue;
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(q)) {
          hits.push(`${path.relative(root, file)}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
          if (hits.length >= 20) return hits.join("\n") + "\n(stopped at 20 matches)";
        }
      }
    }
    return hits.join("\n") || "No matches.";
  }));

  server.registerTool("git_status", {
    description: "Show the branch and which workspace files are new, changed or deleted since the last commit. Use before git_commit. Fails if the workspace is not a git repo.",
    inputSchema: {},
  }, () => run("git_status", "-", async () => (await git("status", "--short", "--branch")) || "Clean."));

  server.registerTool("git_commit", {
    description: "Stage ALL changes in the workspace and commit them with the given message (max 200 characters). Use at the end of a work step. Fails with 'nothing to commit' if there are no changes.",
    inputSchema: { message: z.string().min(1).max(200) },
  }, ({ message }) => run("git_commit", message, async () => {
    await git("add", "-A");
    return await git("commit", "-m", message);
  }));

  server.registerTool("git_log", {
    description: "Show the last 10 commits in the workspace, one per line. Use to see what earlier sessions did. Fails if there are no commits yet.",
    inputSchema: {},
  }, () => run("git_log", "-", async () => await git("log", "--oneline", "-n", "10")));

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

app.listen(PORT, "127.0.0.1", () => console.log(`MCP server on http://127.0.0.1:${PORT}/mcp/<token>`));
