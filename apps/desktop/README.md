# Koying Pilot desktop application

English | [中文](README.zh.md)

Koying Pilot (`柯影智航`) is the branded native desktop distribution packaged and developed by the Koying Digital Intelligence team. The macOS Cocoa shell uses `WKWebView`; the Windows x64 WinForms shell uses Microsoft Edge WebView2. Each shell starts the built `dsh` runtime on an OS-assigned loopback port and displays the existing Web client. The application carries Node and its production dependency closure, so launching it requires no Node, pnpm, repository checkout, or terminal.

The macOS Edit menu routes Undo, Redo, Cut, Copy, Paste, and Select All through the focused Web content with the standard shortcuts. The Windows WebView2 control supplies the corresponding native editing behavior.

The application boots the [`desktop` profile](../../packages/bundle/desktop/README.md). User state is stored under `~/Library/Application Support/Koying Pilot` on macOS and `%LOCALAPPDATA%\Koying Pilot` on Windows, separate from `~/.dsh`. No settings document, credential document, or usable API key is copied into the application or installer. The launcher drops inherited credential-shaped environment variables and disables telemetry; provider credentials entered in the Models page remain in the application's own local data directory.

Settings includes an **About & thanks** page with the product identity, Koying Digital Intelligence team attribution, open-source acknowledgements, version, and credential-storage statement. The Windows application and installer compile [`assets/koying-pilot-icon.ico`](assets/koying-pilot-icon.ico) directly into their native resources. The macOS application continues to derive its icon from [`assets/koying-pilot-icon.png`](assets/koying-pilot-icon.png).

## Connect a model

Open **Settings → Models**. The shipped adapters support the official DeepSeek route, catalog providers such as OpenAI and Anthropic, and declared OpenAI-compatible endpoints. Keys are saved through the local credential service; provider profiles are saved through the local settings service and take effect without rebuilding the application.

For Ollama, add a custom provider using the OpenAI Completions protocol, a base URL such as `http://127.0.0.1:11434/v1`, and the exact installed Ollama model id. The generic OpenAI-compatible transport may require a non-secret placeholder API key even when the local endpoint performs no authentication.

## Build and install on macOS

Building requires macOS with Xcode Command Line Tools, Node 24, and installed repository dependencies.

```sh
pnpm run desktop:build:macos
open "dist-macos/柯影智航-0.1.1.dmg"
```

The DMG contains `柯影智航.app` and an Applications shortcut. Drag the application onto Applications to install it. Packaging generates all macOS icon sizes, verifies the effective desktop composition, boots the deployed runtime, ad-hoc signs the application, and creates the compressed DMG.

## Build and install on Windows x64

Building requires 64-bit Windows 10 or 11, Node 24, installed repository dependencies, PowerShell, the .NET Framework 4.8 x64 compiler, and the Microsoft Edge WebView2 Runtime. The build downloads the pinned Microsoft WebView2 SDK package when its verified cache entry is absent.

```powershell
pnpm run desktop:build:windows
& ".\dist-windows\柯影智航-0.1.1-win-x64-setup.exe"
```

The build produces the unpacked application at `dist-windows/柯影智航` and the single-file installer at `dist-windows/柯影智航-0.1.1-win-x64-setup.exe`. The installer defaults to `%LOCALAPPDATA%\Programs\Koying Pilot`, but its path field and directory browser accept another writable location. An existing installation defaults to its registered location; choosing a new empty directory relocates the application after the new copy is published. Before writing files, the installer checks every payload path against the Windows-compatible file and directory limits and reports the maximum permitted destination length when the selected path is too deep. The installer registers the selected path in Apps & features, creates a Start menu shortcut and an optional desktop shortcut, and requires no administrator privileges for user-writable locations. Uninstalling removes only the registered application directory and preserves settings, sessions, and credentials under `%LOCALAPPDATA%\Koying Pilot`.

The Windows application uses the automatically updated Evergreen WebView2 Runtime. The installer checks for it after installation and offers the official Microsoft download when it is absent.

On either platform, `pnpm run desktop:build` selects the host platform and `pnpm run desktop:build:fast` skips the repository build. The fast form requires current `lib/` and `apps/web/dist` artifacts.

## Known limitations and deferred work

- The shells use loopback HTTP rather than a native IPC carrier.
- The macOS executable targets the build Mac architecture; the Windows artifact is fixed to x64.
- Ollama and other local endpoints must already be running, and the configured model id must exactly match a model they serve.
- The DMG is ad-hoc signed and the Windows executables are unsigned. Public distribution requires platform signing; macOS additionally requires hardened runtime and notarization.
- Windows requires .NET Framework 4.8 and the Evergreen WebView2 Runtime. The installer directs users to Microsoft when WebView2 is absent instead of embedding a fixed browser runtime.
