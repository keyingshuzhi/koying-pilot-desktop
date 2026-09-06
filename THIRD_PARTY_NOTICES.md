# Third-party notices

This repository publishes desktop installation assets and the Koying Pilot native desktop packaging layer, not the full upstream source tree. Each release must include this file and the applicable license texts for components present in that release.

The Koying Pilot 0.1.1 desktop releases are independently packaged from DeepSeek Harness v0.1, which is licensed under the MIT License. The full upstream MIT notice is reproduced in [LICENSE](LICENSE).

The packaged application also contains third-party runtime components. Their identities, versions, license metadata, and license texts must be collected from the exact packaged runtime for each release before publishing. Do not infer the list from development dependencies or reuse a notice file from an unrelated build.

Known runtime families in the 0.1.1 desktop package include Cordis and its foundation libraries, Node.js runtime components, React, TypeScript, `node-pty`, `sharp`, `koffi`, `@vscode/ripgrep`, OpenAI SDK, Anthropic SDK, Model Context Protocol SDK, OpenTelemetry libraries, Shiki, Zod, YAML, and their transitive dependencies. These components use their respective licenses, including MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, and other licenses declared by the packaged component.

Before uploading a release, maintainers must generate and attach an artifact-specific dependency and license inventory. A component that is not packaged must not be listed. Do not distribute optional provider SDKs or platform payloads whose terms have not been independently reviewed for Koying Pilot.
