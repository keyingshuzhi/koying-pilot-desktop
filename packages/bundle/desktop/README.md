# `@deepseek-ai/dsh-desktop`

English | [中文](README.zh.md)

Product layer for the standalone Koying Pilot macOS application. It follows `dsh-base` and `dsh-web-app`, preserves their model adapters, model picker, and Models settings page, then inserts the Koying Pilot About and acknowledgements page.

Provider routes and credentials remain user settings in the application's dedicated Application Support directory. This bundle contains no provider credential or embedded API key; changing providers does not require rebuilding the application.

## Model Experience

None, as the patch-list carrier adds only a browser-side product-information page.

#### KV Cache effect

None; the product-information page adds nothing to the request prefix.

## Known Limitations and Deferred Work

- The desktop shell currently serves the existing browser client over an OS-assigned loopback port. A native IPC carrier remains separate work.
- A provider still needs its own reachable endpoint and, where applicable, a credential configured in Models settings.
