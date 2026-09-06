# Desktop wrapper source

This directory contains the Koying Pilot macOS and Windows packaging layer.

| Path | Purpose |
| --- | --- |
| `native/main.m` | macOS Cocoa and WKWebView application shell |
| `native/windows/` | Windows WinForms/WebView2 shell and installer |
| `scripts/` | macOS and Windows packaging scripts |
| `Info.plist` | macOS application metadata |
| `assets/` | Koying Pilot application icons |

The wrapper starts a bundled DeepSeek Harness runtime on a loopback port and shows its web client in a native window. The Windows installer supports a user-selected writable installation directory and checks the selected path before writing files.

## Build scope

This is not a standalone application source tree. The scripts require a compatible DeepSeek Harness v0.1 workspace with its production dependency closure and built web client. To reproduce a build, use a separately obtained and license-compliant DeepSeek Harness v0.1 checkout, place this directory's contents at its `apps/desktop` path, install its documented dependencies, and run its desktop build command.

Do not commit that upstream checkout, `node_modules`, built runtimes, credentials, certificates, or installer files into this repository. Publish installers through GitHub Releases and update the release-specific hashes and third-party notices at the same time.

## Platform notes

Windows x64 packaging requires Windows, .NET Framework 4.8 x64 compiler support, and the Microsoft Edge WebView2 Runtime. macOS packaging requires macOS and Xcode Command Line Tools. Current public installers are unsigned; release notes must state the signing status.
