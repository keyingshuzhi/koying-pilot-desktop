# Agent Note: Model-neutral native macOS application

Status: implemented

English | [中文](2026-08-20-model-neutral-native-macos-application.zh.md)

> **Superseded product composition.** [Koying Pilot branded model-configurable macOS distribution](2026-08-20-koying-pilot-model-configurable-macos-distribution.md) replaces the model-neutral overlay, product identity, and artifact format. This note remains the rationale for the native Cocoa/`WKWebView` shell and bundled runtime process.

## Problem

The browser profile requires a terminal, a repository checkout or installed CLI, and an independently managed Node runtime. Packaging that profile directly would also let the application inherit the user's Harness home, provider settings, credential references, API-key environment, and model-selection UI. A standalone distribution must start by double-clicking while carrying no usable model route or copied model credentials.

## Decision

`apps/desktop` builds a native macOS application with Cocoa and `WKWebView`. Its Resources directory contains the Node executable used for the build and the production deployment closure of `apps/cli`; the launcher starts that private runtime on an operating-system-assigned loopback port and loads the printed URL into the Web view.

The `desktop` profile stacks `dsh-base`, `dsh-web-app`, and the patch-driven `dsh-desktop` bundle. The desktop patch disables both shipped chat adapters, the LLM title provider, DeepSeek Web search, and both model-configuration client plugins. It replaces the Host API's required default model with an unregistered sentinel. The launcher supplies the same patch again as the final `--patch` layer, after profile and Harness-home overlays, so a user file cannot restore those rows.

The application stores state under `~/Library/Application Support/DeepSeek Harness Desktop` rather than `~/.dsh`. The build copies no settings or credential documents, and the launcher removes inherited environment variables with credential-shaped names before creating the Harness process. Telemetry is disabled for this distribution.

## Alternatives considered

- **Electron**: bundling Chromium duplicates the existing macOS Web view and adds a large runtime dependency without changing the Harness process architecture. The native shell is sufficient for a macOS-only artifact.
- **A native IPC transport instead of loopback HTTP**: this requires a second transport for the existing host/client protocol and a bridge plugin in both planes. The current Web server already binds loopback and supplies the complete client application.
- **Using the user's `~/.dsh` home**: this would make a nominally model-neutral artifact silently inherit provider settings and credentials from another Harness installation.
- **Removing `agentDefaultModel`**: the Host API currently requires that service while creating an agent. An unregistered sentinel preserves the API and fails at the ordinary unknown-provider diagnostic if a conversation is submitted.

## Consequences

- The `.app` launches without Node, pnpm, a terminal, or a repository checkout on the target Mac.
- The artifact targets the build machine's CPU architecture and uses ad-hoc signing. External distribution still requires a universal or separately built runtime, a Developer ID signature, hardened runtime, and notarization.
- The local server remains a child process bound to loopback; the application terminates it during application shutdown and sends `SIGKILL` only after a five-second graceful-termination limit.
- The desktop distribution cannot complete model turns. A distribution that supplies an approved model route is a different composition and must replace the model-neutral final overlay deliberately.
