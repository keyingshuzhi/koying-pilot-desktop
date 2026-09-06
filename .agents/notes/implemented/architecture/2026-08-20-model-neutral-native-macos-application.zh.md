# Agent Note: 模型中立的原生 macOS 应用

Status: implemented

[English](2026-08-20-model-neutral-native-macos-application.md) | 中文

> **产品组装已被取代。** [柯影智航品牌化、可配置模型的 macOS 发行版](2026-08-20-koying-pilot-model-configurable-macos-distribution.md)取代了模型中立 overlay、产品身份和产物格式。本文仍保留原生 Cocoa/`WKWebView` 壳及内置运行时进程的设计依据。

## 问题

浏览器 profile 需要终端、仓库 checkout 或已安装的 CLI，以及单独管理的 Node 运行时。直接打包该 profile 还会让应用继承用户的 Harness home、提供方设置、凭据引用、API key 环境和模型选择界面。独立发行版必须能够双击启动，同时不携带可用模型路由或复制的模型凭据。

## 决策

`apps/desktop` 使用 Cocoa 和 `WKWebView` 构建原生 macOS 应用。其 Resources 目录包含构建时使用的 Node 可执行文件以及 `apps/cli` 的生产部署依赖闭包；启动器在操作系统分配的 loopback 端口上启动这套私有运行时，并把输出的 URL 加载进 Web view。

`desktop` profile 叠放 `dsh-base`、`dsh-web-app` 和由 patch 驱动的 `dsh-desktop` 组合包。桌面 patch 禁用两个随附的聊天适配器、LLM 标题提供方、DeepSeek Web 搜索以及两个模型配置客户端插件，并把 Host API 要求的默认模型替换为未注册的占位值。启动器在 profile 与 Harness home overlay 之后，把同一 patch 再次作为最终 `--patch` 层传入，因此用户文件无法恢复这些配置项。

应用把状态存放在 `~/Library/Application Support/DeepSeek Harness Desktop`，而非 `~/.dsh`。构建过程不复制设置或凭据文档，启动器在创建 Harness 进程前删除名称类似凭据的继承环境变量。该发行版禁用遥测。

## 考虑过的替代方案

- **Electron**：打包 Chromium 会重复 macOS 已有的 Web view，增加大型运行时依赖，却不改变 Harness 进程架构。原生外壳足以生成仅限 macOS 的产物。
- **使用原生 IPC 传输而非 loopback HTTP**：这需要为现有 host/client 协议增加第二种传输，并在两侧加入桥接插件。现有 Web 服务器已绑定 loopback，并提供完整客户端应用。
- **使用用户的 `~/.dsh` home**：这会让名义上模型中立的产物静默继承另一套 Harness 安装的提供方设置与凭据。
- **移除 `agentDefaultModel`**：Host API 目前在创建 agent 时要求该服务。未注册的占位值保留 API；如果提交对话，系统会按普通未知提供方诊断快速失败。

## 后果

- 目标 Mac 无需安装 Node、pnpm、终端或仓库 checkout 即可启动 `.app`。
- 产物目标架构与构建机器的 CPU 架构一致，并使用 ad-hoc 签名。外部分发仍需 universal 或分别构建的运行时、Developer ID 签名、hardened runtime 和公证。
- 本地服务器仍是绑定 loopback 的子进程；应用关闭时先终止它，仅在五秒优雅终止期限后才发送 `SIGKILL`。
- 桌面发行版不能完成模型轮次。提供经批准模型路由的发行版属于另一种组合，必须有意替换模型中立的最终 overlay。
