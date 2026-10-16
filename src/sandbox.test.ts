import test from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveSafe } from "./sandbox.js";

async function setup() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "sbx-"));
  const root = path.join(base, "workspace");
  await fs.mkdir(root);
  await fs.mkdir(path.join(base, "workspace-evil"));
  await fs.symlink(base, path.join(root, "link-out"));
  return root;
}

test("allows normal paths", async () => {
  const root = await setup();
  await resolveSafe(root, "notes/a.txt");
  await resolveSafe(root, ".");
});

for (const bad of ["../x", "../../etc/passwd", "/etc/passwd", "C:\\Windows", "..\\x", "../workspace-evil/x", "link-out/secret"]) {
  test(`rejects ${bad}`, async () => {
    const root = await setup();
    await assert.rejects(() => resolveSafe(root, bad));
  });
}
