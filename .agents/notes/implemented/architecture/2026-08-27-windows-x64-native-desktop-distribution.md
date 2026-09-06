# Agent Note: Windows x64 native desktop distribution

Status: implemented

English | [中文](2026-08-27-windows-x64-native-desktop-distribution.zh.md)

## Problem

The [branded macOS distribution](2026-08-20-koying-pilot-model-configurable-macos-distribution.md) gives Mac users a native shell, bundled runtime, and conventional installer, but Windows users have no equivalent artifact. A Windows release must preserve the same desktop composition and credential isolation, close the complete runtime process tree with the window, and install without requiring Node, a repository checkout, developer tools, or administrator privileges on the target machine.

## Decision

`apps/desktop/native/windows/KoyingPilot.cs` is an x64 .NET Framework 4.8 WinForms shell over Microsoft Edge WebView2. It launches the packaged x64 `node.exe` and deployed `dsh` entry with the `desktop` profile on an operating-system-assigned loopback port. Navigation remains inside the WebView only for `http://127.0.0.1`, `http://localhost`, and `about:` URLs; HTTP(S) links outside loopback open in the default browser. The launcher removes inherited credential-shaped environment variables, disables telemetry, and stores application state under `%LOCALAPPDATA%\Koying Pilot`.

The launcher assigns Node to a Windows Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`. Closing the native window therefore terminates Node and every descendant process even when an individual child does not cooperate with graceful shutdown.

`apps/desktop/scripts/build-windows-app.mjs` deploys the production dependency closure, copies the current x64 Node executable, compiles the shell and uninstaller with the Windows .NET Framework compiler, and packages the unpacked application plus a single-file setup executable under `dist-windows`. The Windows shell, uninstaller, and setup stub compile `apps/desktop/assets/koying-pilot-icon.ico` directly into their native resources. The setup payload is a ZIP followed by a length-and-magic trailer. `%LOCALAPPDATA%\Programs\Koying Pilot` is the default, while the setup path field and directory browser accept another writable location. The installer rejects filesystem roots, overlap with `%LOCALAPPDATA%\Koying Pilot`, and nonempty destinations other than the registered installation. It scans every payload entry before writing and reports the maximum destination length when a selected path would exceed Windows-compatible file or directory limits. Update staging and rollback use one-character sibling directory names so their safety mechanism does not make a valid final path exceed those limits. The installer restores the previous installation if publication fails and removes a prior recognized program directory only after publishing and registering a relocated copy. It creates Start menu and optional desktop shortcuts, records the selected path in Apps & features, and treats that registered path as the uninstall deletion authority. Application data remains in place during uninstall.

The build pins the Microsoft WebView2 SDK version and SHA-256. The installed application uses the shared Evergreen WebView2 Runtime so browser security updates remain owned by Microsoft; the installer checks availability and offers Microsoft's official download when the runtime is absent. The application does not embed a fixed browser runtime.

`desktop:build` and `desktop:build:fast` dispatch to the host platform. Explicit macOS and Windows commands remain available for release automation and produce architecture-labelled installer names.

## Verification

The Windows packager verifies the runtime dependency closure, effective model composition, deployed About client bundle, credential-free runtime startup, native WebView2 availability, required x64 files, the supplied ICO resource, and a complete extraction of the appended installer payload. Source tests pin the loopback navigation restriction, credential filtering, Job Object lifetime, selectable destination controls, payload-aware path validation, short staging names, registry-bound uninstall, ICO selection, x64 compilation, and WebView2 SDK digest. No keyless transcript snapshot changes because the Windows shell presents the existing `desktop` Web client without changing model-visible or transcript output.

## Alternatives considered

- **Use Electron for Windows**: Electron would add a second Chromium and Node distribution while the product still needs its private Node runtime for native-module ABI compatibility. WebView2 reuses the maintained system runtime and keeps the shell small.
- **Use the legacy WinForms `WebBrowser` control**: its Internet Explorer engine cannot reliably run the built modern Web client and does not receive the Chromium security model used by supported browsers.
- **Require NSIS, Inno Setup, WiX, or MSIX tooling**: those toolchains are not part of the repository's Windows prerequisites. The compiled per-user installer provides shortcuts, registration, upgrade staging, and uninstall behavior with the same .NET Framework compiler as the shell.
- **Bundle a fixed WebView2 Runtime**: this would substantially increase every artifact and make browser servicing part of each application release. Evergreen keeps one automatically updated runtime; the installer handles the missing-runtime case explicitly.

## Consequences

- Windows 10 and 11 x64 users receive an application directory and a conventional `.exe` installer without requiring Node or administrator access for user-writable destinations; protected system locations still require permissions the per-user installer does not request.
- Build hosts require Node 24, PowerShell, the .NET Framework 4.8 x64 compiler, and WebView2 Runtime; the pinned WebView2 SDK is downloaded only when its verified cache entry is absent.
- Target machines require .NET Framework 4.8 and Evergreen WebView2 Runtime. The installer directs a missing runtime to Microsoft instead of silently leaving an unusable application.
- Settings, sessions, and credentials survive uninstall by design, matching the separation between program files and user data.
- The generated Windows executables are unsigned until release automation supplies a code-signing certificate; Windows may display SmartScreen warnings for unsigned distribution builds.
