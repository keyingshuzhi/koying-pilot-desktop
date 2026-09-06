# Agent Note: Koying Pilot branded model-configurable macOS distribution

Status: implemented

English | [中文](2026-08-20-koying-pilot-model-configurable-macos-distribution.zh.md)

## Problem

The first native desktop artifact intentionally removed every model route and model-settings surface. A product distribution instead needs users to connect cloud or local providers after installation, carry its own identity, attribute the team that packages it, acknowledge its upstream projects, and arrive as a conventional macOS installer rather than a bare development `.app`.

## Decision

The product is named **Koying Pilot** (`柯影智航`) and identifies the Koying Digital Intelligence team as its packaging and development owner. The native shell, bundle identifier, executable, Application Support directory, menu, application filename, and window title use that product identity. Its generated image asset is compiled into the complete macOS `.icns` size set during packaging.

The `desktop` profile retains the model adapters, model picker, and Models settings page supplied by `dsh-base` and `dsh-web-app`. The native launcher no longer reapplies the desktop patch after user settings. Provider profiles and managed credentials therefore remain writable application-local state under `~/Library/Application Support/Koying Pilot`; no credential is embedded in the application or installer, and inherited credential-shaped environment variables remain removed.

`@deepseek-ai/dsh-client-ui-about` is a desktop-only client plugin. It contributes a localized Settings section containing product identity, team attribution, acknowledgements, version, and the local-credential statement. It also owns the desktop document title and replaces the shared sidebar artwork through semantic brand hooks on the default wordmark and symbol. Other profiles retain the shared artwork because the replacement is active only while the product plugin is mounted. The desktop bundle inserts that plugin without modifying model-facing rows.

The packager verifies the effective desktop composition keeps both provider adapters and both model-configuration UI rows enabled, boots the deployed runtime without credentials, ad-hoc signs the application, and creates a compressed DMG containing the application plus an Applications shortcut.

## Alternatives considered

- **Keep a model-neutral application and require a second edition for providers**: this would make ordinary model onboarding an installer choice and duplicate the desktop product.
- **Embed a default API key or provider credential**: every installed copy would share a secret and artifact inspection would recover it. Application-local credential storage keeps the installer reusable and secrets per user.
- **Put acknowledgements only in native About**: the product's working UI is the Web settings surface; a client plugin keeps the attribution visible there and independently composable.
- **Ship only a ZIP or bare `.app`**: neither presents the standard drag-to-Applications install flow. A DMG preserves the signed application bundle and supplies that flow without a privileged installer script.

## Consequences

- A fresh installation can configure DeepSeek, catalog cloud providers, or a declared OpenAI-compatible endpoint such as Ollama from Models settings.
- Removing inherited credential-shaped environment variables means Finder launches never borrow an unrelated shell credential; users configure credentials in the application.
- The generated DMG is locally installable but remains ad-hoc signed. Public distribution requires Developer ID signing, hardened runtime, and notarization.
- Product copy and acknowledgements are compiled client assets and change only with a rebuilt release.
- The shared brand primitives expose stable semantic attributes; product CSS may replace their presentation without forking the sidebar shell.
