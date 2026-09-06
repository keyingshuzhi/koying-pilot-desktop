# 柯影智航桌面应用

[English](README.md) | 中文

柯影智航（Koying Pilot）是由柯影数智团队封装开发的品牌化原生桌面发行版。macOS Cocoa 壳使用 `WKWebView`，Windows x64 WinForms 壳使用 Microsoft Edge WebView2。两个原生壳都会在操作系统分配的 loopback 端口上启动构建后的 `dsh` 运行时，并显示现有 Web 客户端。应用携带 Node 和生产依赖闭包，因此启动时不要求安装 Node、pnpm、仓库 checkout 或终端。

macOS“编辑”菜单通过标准快捷键把撤销、重做、剪切、复制、粘贴和全选传给当前聚焦的 Web 内容。Windows WebView2 控件提供对应的原生编辑行为。

应用启动 [`desktop` profile](../../packages/bundle/desktop/README.md)。用户状态在 macOS 上保存到 `~/Library/Application Support/Koying Pilot`，在 Windows 上保存到 `%LOCALAPPDATA%\Koying Pilot`，均与 `~/.dsh` 分离。应用和安装包不会复制设置文档、凭据文档或可用 API 密钥。启动器会删除继承环境中名称类似凭据的变量并禁用遥测；在“模型”页面录入的提供方凭据只保存在应用自己的本地数据目录中。

设置中包含“**关于与致谢**”页面，展示产品身份、柯影数智团队署名、开源致谢、版本及凭据保存说明。Windows 应用和安装器会将 [`assets/koying-pilot-icon.ico`](assets/koying-pilot-icon.ico) 直接编译进原生资源。macOS 应用仍从 [`assets/koying-pilot-icon.png`](assets/koying-pilot-icon.png) 生成图标。

## 接入模型

打开“**设置 → 模型**”。随附适配器支持 DeepSeek 官方路由、OpenAI 与 Anthropic 等 catalog 提供方，以及自定义 OpenAI 兼容端点。密钥通过本地凭据服务保存，提供方 profile 通过本地设置服务保存，无需重新构建应用即可生效。

接入 Ollama 时，新增自定义提供方，协议选择 OpenAI Completions，API 地址可填写 `http://127.0.0.1:11434/v1`，模型 ID 必须与 Ollama 已安装模型完全一致。即使本地端点不校验身份，通用 OpenAI 兼容传输也可能要求填写一个不含秘密的占位 API Key。

## 在 macOS 上构建和安装

构建要求装有 Xcode Command Line Tools 的 macOS、Node 24 和已安装的仓库依赖。

```sh
pnpm run desktop:build:macos
open "dist-macos/柯影智航-0.1.1.dmg"
```

DMG 内含 `柯影智航.app` 和“应用程序”快捷方式；把应用拖入“应用程序”即可安装。封装流程会生成全部 macOS 图标尺寸，验证 desktop 有效组装，启动部署后的运行时，使用 ad-hoc 签名应用，并创建压缩 DMG。

## 在 Windows x64 上构建和安装

构建要求 64 位 Windows 10 或 11、Node 24、已安装的仓库依赖、PowerShell、.NET Framework 4.8 x64 编译器以及 Microsoft Edge WebView2 Runtime。如果经过校验的缓存项不存在，构建会下载固定版本的 Microsoft WebView2 SDK 包。

```powershell
pnpm run desktop:build:windows
& ".\dist-windows\柯影智航-0.1.1-win-x64-setup.exe"
```

构建会在 `dist-windows/柯影智航` 生成解压后的应用，并在 `dist-windows/柯影智航-0.1.1-win-x64-setup.exe` 生成单文件安装包。安装器默认使用 `%LOCALAPPDATA%\Programs\Koying Pilot`，但可以通过路径输入框或目录浏览器选择其他可写位置。已有安装会默认显示注册过的位置；选择新的空目录后，安装器会先发布新副本，再迁移应用。写入文件前，安装器会根据 Windows 兼容的文件和目录限制检查每一条载荷路径；所选位置过深时，错误信息会给出目标目录的最大允许长度。安装器会在“应用和功能”中注册所选路径，创建开始菜单快捷方式和可选桌面快捷方式；安装到用户可写位置不要求管理员权限。卸载只删除已登记的程序目录，并保留 `%LOCALAPPDATA%\Koying Pilot` 下的设置、会话和凭据。

Windows 应用使用自动更新的 Evergreen WebView2 Runtime。安装器在完成安装后检查该运行时；如果缺失，会提供 Microsoft 官方下载入口。

在两个平台上，`pnpm run desktop:build` 会选择宿主平台，`pnpm run desktop:build:fast` 会跳过仓库构建。快速构建要求已有最新的 `lib/` 与 `apps/web/dist` 产物。

## 已知限制与暂缓事项

- 桌面壳使用 loopback HTTP，而不是原生 IPC carrier。
- macOS 可执行文件面向执行构建的 Mac 架构；Windows 产物固定为 x64。
- Ollama 等本地端点必须已启动，配置的模型 ID 必须与其实际提供的模型完全一致。
- DMG 使用 ad-hoc 签名，Windows 可执行文件尚未签名。公开分发需要对应平台的正式签名；macOS 还需要 hardened runtime 和公证。
- Windows 要求 .NET Framework 4.8 与 Evergreen WebView2 Runtime。WebView2 缺失时，安装器会引导用户从 Microsoft 下载，而不是内嵌固定浏览器运行时。
