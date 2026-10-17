# MCP File Server

A sandboxed [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that gives AI agents a safe, shared workspace. Agents can list, read, write, edit and search files, and use a few git commands, all inside one folder. It is served over HTTPS and protected by a secret in the URL. Handoff files let a second agent session pick up exactly where the first one stopped.

Built for CS 3A / CS 3B, Week 6, Midterms Pt 1.

```
AI client (e.g. Claude)
        |  HTTPS
        v
  ngrok tunnel (fixed public URL)
        |
        v
  Express + MCP server  (127.0.0.1:3000, kept alive by pm2)
        |
        v
  workspace/   <- the only folder the tools can touch
```

## Features

- **Sandboxed workspace.** Every path is resolved against `workspace/`. `../`, absolute paths, Windows drive letters, backslash tricks and symlinks that point outside are all rejected.
- **9 single-purpose tools** with strict zod schemas and descriptions that say how each one fails.
- **Secret URL.** The endpoint is `/mcp/<secret>`. A wrong secret gets `401`.
- **Guards.** Write size limit, `.git` folder blocked, handoff files cannot be deleted, `delete_file` needs `confirm=true`.
- **Call log.** Every tool call is appended to `logs/calls.log`.
- **Handoff protocol.** `PROJECT_STATE`, `PLAN_LOG`, `CHECKPOINTS` and `DECISIONS` carry context across sessions.
- **Survives restarts** with pm2.

## Requirements

- Node.js **20.6 or newer** (the server loads `.env` with `--env-file`)
- git
- pm2 (`npm install -g pm2`)
- A free [ngrok](https://ngrok.com) account
- An MCP client that supports remote servers (claude.ai custom connectors, or Claude Code)

---

## 1. Install the prerequisites

### Linux

```bash
# Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# close and reopen the terminal, then:
nvm install --lts
node -v

# git (Fedora shown; use apt on Debian/Ubuntu)
sudo dnf install git

# pm2
npm install -g pm2
pm2 -v
```

If `npm install -g` gives a permissions error, you probably installed Node with the system package manager. Fix it without `sudo`:

```bash
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH=$HOME/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g pm2
```

### Windows (PowerShell)

```powershell
# Node.js LTS and git (or download the installers from nodejs.org and git-scm.com)
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

Close PowerShell and open a new window, then:

```powershell
node -v
npm install -g pm2
pm2 -v
```

If PowerShell refuses to run npm scripts ("running scripts is disabled"), run this once and try again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Both: tell git who you are

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

The `git_commit` tool uses this identity.

---

## 2. Get the code

```bash
git clone https://github.com/YOUR-USERNAME/mcp-file-server.git
cd mcp-file-server
npm install
```

---

## 3. Create the workspace

`workspace/` is not stored in this repo (it is the agents' area, and it is git-ignored). Create it from the template and make it its own git repo, which the `git_*` tools use:

**Linux**
```bash
cp -r workspace-template workspace
cd workspace && git init && cd ..
```

**Windows**
```powershell
Copy-Item -Recurse workspace-template workspace
cd workspace; git init; cd ..
```

---

## 4. Configure

Copy the example file:

**Linux:** `cp .env.example .env`
**Windows:** `Copy-Item .env.example .env`

Generate a secret (same command on both systems):

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Open `.env` in an editor and fill it in. Use the **absolute path** of your workspace folder:

```
PORT=3000
WORKSPACE_ROOT=/home/you/projects/mcp-file-server/workspace
AUTH_TOKEN=paste-the-generated-secret-here
NGROK_DOMAIN=your-domain.ngrok-free.dev
```

On Windows the path looks like `C:\Users\you\projects\mcp-file-server\workspace` (no quotes needed).

**Never commit `.env`.** It is already in `.gitignore`. Treat `AUTH_TOKEN` like a password.

---

## 5. Build and test

```bash
npx tsc
npx tsx --test src/sandbox.test.ts
```

All sandbox tests should pass (path traversal, absolute paths, drive letters, backslashes, a sibling-folder prefix trick, and a symlink pointing outside).

> **Windows note:** the symlink test creates a symlink, which Windows only allows in an administrator terminal or with Developer Mode turned on (Settings → For developers). If that one test fails with `EPERM`, enable Developer Mode or run the tests as administrator. The other tests do not need it.

---

## 6. Run the server

**Quick test (stops when you close the terminal):**

```bash
node --env-file=.env dist/server.js
```

**Keep it running with pm2** (run these from the project folder, so `.env` is found):

```bash
pm2 start dist/server.js --name mcp-server --node-args="--env-file=.env"
pm2 save
pm2 ls
```

After any code change, rebuild and restart:

```bash
npx tsc && pm2 restart mcp-server
```

### Start automatically after a reboot

**Linux**
```bash
pm2 startup
```
Copy the `sudo env PATH=...` line it prints, run it, then run `pm2 save` again.

**Windows:** `pm2 startup` does not work on Windows. One option is the `pm2-windows-startup` package:
```powershell
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```
(This was not tested for this project. Windows Task Scheduler running `pm2 resurrect` at logon is an alternative.)

---

## 7. Set up the public tunnel (ngrok)

1. Create a free account at [ngrok.com](https://ngrok.com).
2. Install ngrok and add your auth token. Use the install steps and the `ngrok config add-authtoken ...` line shown in your ngrok dashboard for your system.
3. In the dashboard, open **Domains**. Your free static domain is listed there. Copy it into `NGROK_DOMAIN` in `.env` (no `https://`).

**Linux** (tarball install if you do not use the dashboard steps):
```bash
cd ~/Downloads
curl -sSLO https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
sudo tar -xzf ngrok-v3-stable-linux-amd64.tgz -C /usr/local/bin
ngrok version
```
Run the tunnel under pm2 using the included script:
```bash
chmod +x tunnel.sh
pm2 start ./tunnel.sh --name tunnel --interpreter bash
pm2 save
```

**Windows:** install ngrok from the dashboard instructions (or `winget install ngrok.ngrok`), then run it in its own PowerShell window and leave it open:
```powershell
ngrok http 3000 --url=your-domain.ngrok-free.dev
```

Your public connector URL is:

```
https://YOUR-DOMAIN/mcp/YOUR_SECRET
```

---

## 8. Check that it works

**Wrong secret must be rejected (expect `401`):**

Linux:
```bash
curl -i -X POST https://YOUR-DOMAIN/mcp/wrong -H "Content-Type: application/json" -d '{}'
```
Windows (use `curl.exe`, because plain `curl` is a PowerShell alias):
```powershell
curl.exe -i -X POST https://YOUR-DOMAIN/mcp/wrong -H "Content-Type: application/json" -d "{}"
```

**Inspector:**

```bash
npx @modelcontextprotocol/inspector
```
In the browser, add a server using **Streamable HTTP** with the URL `http://127.0.0.1:3000/mcp/YOUR_SECRET`, connect, open **Tools**, and run `list_files`. Then try `read_file` with the path `../package.json`. It must be rejected.

---

## 9. Connect a real MCP client

**claude.ai:** Settings, then Connectors, then **Add custom connector**. Name it `my-file-server` and paste your connector URL. Start a new chat, switch the connector on, and ask Claude to list the files in your workspace. (Custom connectors depend on your plan.)

**Claude Code:**
```bash
claude mcp add --transport http my-file-server https://YOUR-DOMAIN/mcp/YOUR_SECRET
```

When you add new tools or restart the server, reconnect the connector so the client refreshes its tool list.

---

## Tools

| Tool | What it does |
|---|---|
| `list_files` | List a directory. Folders end with `/`. |
| `read_file` | Read a text file (max 100 KB). |
| `write_file` | Create or overwrite a file (max 200,000 characters). |
| `str_replace` | Replace one exact, unique occurrence of text in a file. |
| `delete_file` | Delete one file. Needs `confirm=true`. Handoff files are protected. |
| `search_files` | Case-insensitive text search, up to 20 `file:line: text` matches. |
| `git_status` | Show changes in the workspace repo. |
| `git_commit` | Stage everything and commit with a message. |
| `git_log` | Show the last 10 commits. |

Failures come back as `isError` results with a readable message, never a stack trace.

## Handoff protocol

Agents share state through four files in `workspace/`:

- `PROJECT_STATE.md`: goal, current status, next step, and the session rules. **Read first, update before stopping.**
- `PLAN_LOG.md`: the plan and one line per step taken.
- `CHECKPOINTS.md`: a snapshot at the end of each session.
- `DECISIONS.md`: choices and the reasons behind them.

The three log files end with the marker `<!-- NEXT ENTRY ABOVE -->`. Agents add entries by inserting text above it with `str_replace`, so they never rewrite a whole log file.

## Security notes

- Paths are normalized, checked, and resolved with `realpath` so symlinks cannot lead outside `workspace/`.
- The `.git` folder is off limits to the file tools. Git is only reachable through the three `git_*` tools, which run `git` with an argument list (no shell).
- The secret lives in the URL path, so it can end up in tunnel logs and browser history. Header or OAuth authentication would be stronger.
- Deleting is gated (`confirm`), logged, and blocked for handoff files.
- Keep `.env` private and rotate `AUTH_TOKEN` if it ever leaks (change it in `.env`, then `pm2 restart mcp-server` and update your connector URL).

## Project layout

```
mcp-file-server/
├── src/
│   ├── server.ts          # MCP server, tools, auth route
│   ├── sandbox.ts         # resolveSafe(): the path sandbox
│   └── sandbox.test.ts    # path traversal tests
├── workspace-template/    # starter workspace (handoff files)
├── workspace/             # created in step 3 (git-ignored)
├── logs/calls.log         # one line per tool call
├── evidence/              # transcripts, PLAN_LOG, CHECKPOINTS, call log
├── tunnel.sh              # ngrok under pm2 (Linux)
├── .env.example
└── README.md
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `401 Unauthorized` from the real URL | The secret in the URL does not match `AUTH_TOKEN` in `.env`. Restart after editing `.env`. |
| `404` on `/mcp/...` | You are running old code. Run `npx tsc && pm2 restart mcp-server`. |
| Connector shows old tools | Disconnect and reconnect it, or remove and re-add it. |
| `EADDRINUSE` | Something already uses port 3000. Run `pm2 ls` and stop the old process. |
| Tunnel shows "endpoint already online" | Only one ngrok session can use the free domain. Stop the other one. |
| pm2 process is "online" but nothing works | Check `pm2 logs mcp-server` and `pm2 logs tunnel`. Old errors stay in the log until `pm2 flush`. |
| `git_commit` fails | Run `git init` inside `workspace/` and set `git config --global user.name` and `user.email`. |

## Course evidence

The `evidence/` folder holds the two-session transcripts, the final `PLAN_LOG`, `CHECKPOINTS` and `DECISIONS` files, and the tool call log from the demo task.
