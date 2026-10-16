import fs from "node:fs/promises";
import path from "node:path";

// Find the real location of a path, even if the file doesn't exist yet.
async function realpathLoose(p: string): Promise<string> {
  const tail: string[] = [];
  let cur = p;
  while (true) {
    try {
      const real = await fs.realpath(cur);
      return path.join(real, ...tail.reverse());
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
      const parent = path.dirname(cur);
      if (parent === cur) throw e;
      tail.push(path.basename(cur));
      cur = parent;
    }
  }
}

export async function resolveSafe(root: string, userPath: string): Promise<string> {
  if (userPath.includes("\0")) throw new Error("Invalid path.");
  // Treat backslashes as separators on every OS, so ..\x is checked like ../x
  const cleaned = userPath.replace(/\\/g, "/");
  if (path.posix.isAbsolute(cleaned) || /^[a-zA-Z]:/.test(cleaned)) {
    throw new Error("Absolute paths are not allowed. Use a path relative to the workspace.");
  }
  const rootReal = await fs.realpath(root);
  const real = await realpathLoose(path.resolve(rootReal, cleaned));
  const rel = path.relative(rootReal, real);
  if (rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) {
    throw new Error("Path escapes the workspace and was rejected.");
  }
  return real;
}
