# Orca Integration

## What it is

[Orca](https://github.com/stablyai/orca) is an open-source Agent Development Environment (ADE)
from Stably. It runs multiple CLI coding agents — Claude Code, Codex, OpenCode, and others — in
parallel, each in its own isolated git worktree, so changes from different agents or approaches
can be compared and evaluated side by side. It is a standalone desktop/CLI application, not an
npm dependency of Nehemiah Command.

## How this repo is wired up

`orca.yaml` at the repo root tells Orca how to bootstrap a fresh worktree for this project:

```yaml
scripts:
  setup: |
    npm ci
```

This mirrors the "Local development" steps in the root `README.md`, so every worktree Orca
creates for Nehemiah Command is immediately runnable with `npm run dev`.

## Installing Orca

### Desktop (macOS / Windows / Linux / Arch)

- macOS (Homebrew): `brew install --cask stablyai/orca/orca`
- Arch Linux (AUR): `yay -S stably-orca-bin`
- Windows / Linux: [onorca.dev/download](https://onorca.dev/download) or the
  [latest GitHub release](https://github.com/stablyai/orca/releases/latest)

### Headless Linux server

To run Orca on a shared/remote Linux box (for example, a dev server used to orchestrate Claude
Code sessions against this repo), use `scripts/install-orca-headless.sh`. It automates Orca's own
[headless server guide](https://github.com/stablyai/orca/blob/main/docs/reference/headless-linux-server.md):
installs prerequisites (`Xvfb`, FUSE), downloads the latest Linux AppImage to `/opt/orca`, creates
a dedicated `orca` service user, and registers a `orca-serve.service` systemd unit on port 6768.

```bash
sudo ./scripts/install-orca-headless.sh [--pairing-address <host-or-ip>]
```

Review the script before running it on a machine you don't control — it downloads and executes a
third-party binary and installs a systemd service running as root-owned but non-root-executed.

## Using it with this repo

1. Install Orca (desktop or headless) as above.
2. Point Orca at a local clone of `nehemiah-command-`; it reads `orca.yaml` to set up each worktree.
3. Assign Claude Code (or another supported CLI agent) to a worktree from Orca's UI/CLI to start
   an orchestrated session against this codebase.

## Out of scope

Orca is not started as part of `npm run dev`, is not a build/runtime dependency, and this
integration does not modify Nehemiah's production deployment. It only affects local/dev tooling.
