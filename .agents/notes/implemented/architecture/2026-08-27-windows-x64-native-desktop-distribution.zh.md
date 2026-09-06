# Agent Note: Windows x64 原生桌面发行版

Status: implemented

[English](2026-08-27-windows-x64-native-desktop-distribution.md) | 中文

## 问题

[品牌化 macOS 发行版](2026-08-20-koying-pilot-model-configurable-macos-distribution.md)为 Mac 用户提供原生壳、内置运行时和常规安装包，但 Windows 用户没有等价产物。Windows 发行版必须保留相同的桌面组合与凭据隔离，在窗口关闭时结束完整运行时进程树，并且在目标机器上不要求 Node、仓库 checkout、开发工具或管理员权限即可安装。

## 决策

`apps/desktop/native/windows/KoyingPilot.cs` 是基于 Microsoft Edge WebView2 的 x64 .NET Framework 4.8 WinForms 壳。它使用 `desktop` profile，在操作系统分配的 loopback 端口上启动随包提供的 x64 `node.exe` 和已部署的 `dsh` 入口。只有 `http://127.0.0.1`、`http://localhost` 和 `about:` URL 会留在 WebView 内；loopback 之外的 HTTP(S) 链接交给默认浏览器。启动器会删除继承环境中名称类似凭据的变量、禁用遥测，并把应用状态保存到 `%LOCALAPPDATA%\Koying Pilot`。

启动器把 Node 分配到设置了 `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` 的 Windows Job Object。因此，即使某个子进程不配合优雅关闭，关闭原生窗口也会结束 Node 及其全部后代进程。

`apps/desktop/scripts/build-windows-app.mjs` 部署生产依赖闭包，复制当前 x64 Node 可执行文件，使用 Windows .NET Framework 编译器编译原生壳和卸载器，并在 `dist-windows` 下封装解压后的应用与单文件安装程序。Windows 壳、卸载器和安装程序 stub 会将 `apps/desktop/assets/koying-pilot-icon.ico` 直接编译进原生资源。安装载荷是末尾附加长度和 magic 标记的 ZIP。安装器默认使用 `%LOCALAPPDATA%\Programs\Koying Pilot`，并允许通过路径输入框或目录浏览器选择其他可写位置。它会拒绝文件系统根目录、与 `%LOCALAPPDATA%\Koying Pilot` 用户数据目录重叠的位置，以及当前登记安装位置以外的非空目标。写入文件前，安装器会扫描每一条载荷路径；所选位置会超出 Windows 兼容的文件或目录限制时，它会报告目标目录的最大允许长度。更新暂存和回滚使用单字符同级目录名，确保安全机制不会让有效的最终路径超过这些限制。发布失败时，安装器会恢复先前安装；迁移安装时，只有在新副本发布并登记后才删除之前可识别的程序目录。它会创建开始菜单快捷方式和可选桌面快捷方式，在“应用和功能”中记录所选路径，并只把该登记路径作为卸载删除目标。卸载时会保留应用数据。

构建固定 Microsoft WebView2 SDK 版本与 SHA-256。安装后的应用使用共享 Evergreen WebView2 Runtime，使浏览器安全更新继续由 Microsoft 负责；安装器检查运行时是否可用，缺失时提供 Microsoft 官方下载入口。应用不内嵌固定浏览器运行时。

`desktop:build` 与 `desktop:build:fast` 会分派到宿主平台。发行自动化仍可使用显式 macOS 和 Windows 命令，并生成带架构标识的安装包名称。

## 验证

Windows 封装器会验证运行时依赖闭包、有效模型组合、部署后的 About 客户端 bundle、无凭据运行时启动、原生 WebView2 可用性、必要 x64 文件、提供的 ICO 资源以及附加安装载荷的完整解压。源码测试固定 loopback 导航限制、凭据过滤、Job Object 生命周期、可选安装位置控件、载荷感知的路径校验、短暂存目录名、与注册信息绑定的卸载、ICO 选择、x64 编译和 WebView2 SDK 摘要。Windows 壳只显示现有 `desktop` Web 客户端，不改变模型可见内容或 transcript 输出，因此没有需要变更的 keyless transcript snapshot。

## 考虑过的替代方案

- **在 Windows 上使用 Electron**：Electron 会额外携带 Chromium 和 Node，而产品仍需私有 Node 运行时以保持原生模块 ABI 兼容。WebView2 复用受维护的系统运行时，并让原生壳保持轻量。
- **使用旧版 WinForms `WebBrowser` 控件**：其 Internet Explorer 引擎无法可靠运行构建后的现代 Web 客户端，也不具备受支持浏览器使用的 Chromium 安全模型。
- **要求 NSIS、Inno Setup、WiX 或 MSIX 工具链**：这些工具链不属于仓库的 Windows 前置条件。编译后的按用户安装器使用与原生壳相同的 .NET Framework 编译器，即可提供快捷方式、安装注册、更新暂存和卸载行为。
- **内嵌固定 WebView2 Runtime**：这会显著增大每个产物，并让浏览器维护成为每次应用发布的责任。Evergreen 只保留一套自动更新的运行时；安装器明确处理运行时缺失情形。

## 后果

- Windows 10 和 11 x64 用户会获得应用目录和常规 `.exe` 安装包；用户可写目标不需要 Node 或管理员权限，受保护的系统位置仍要求此按用户安装器不会申请的权限。
- 构建宿主需要 Node 24、PowerShell、.NET Framework 4.8 x64 编译器和 WebView2 Runtime；只有经过校验的缓存项不存在时，才会下载固定版本的 WebView2 SDK。
- 目标机器需要 .NET Framework 4.8 和 Evergreen WebView2 Runtime。运行时缺失时，安装器会引导用户前往 Microsoft，而不是静默留下无法使用的应用。
- 设置、会话与凭据在卸载后按设计保留，符合程序文件与用户数据分离的约定。
- 在发行自动化提供代码签名证书之前，生成的 Windows 可执行文件不带签名；Windows 可能对未签名发行产物显示 SmartScreen 警告。
