import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 3000);
const WORKSPACE = path.resolve(process.env.WORKSPACE_ROOT ?? "./workspace");

function buildServer() {
  const server = new McpServer({ name: "file-server", version: "0.1.0" });

  server.registerTool(
    "list_files",
    {
      description:
        "List files and folders inside a directory of the workspace. Folders end with '/'. Fails if the directory does not exist.",
      inputSchema: { dir: z.string().default(".") },
    },
    async ({ dir }) => {
      try {
        const entries = await fs.readdir(path.join(WORKSPACE, dir), { withFileTypes: true });
        const lines = entries.map((e) => (e.isDirectory() ? e.name + "/" : e.name));
        return { content: [{ type: "text" as const, text: lines.join("\n") || "(empty)" }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Could not list '${dir}': ${(err as Error).message}` }],
        };
      }
    }
  );

  return server;
}

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
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
