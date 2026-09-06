# 柯影智航桌面版

柯影智航（Koying Pilot）是面向 macOS 与 Windows 的独立桌面 AI 助手应用。

本仓库用于发布已构建的桌面安装包、校验值、适用的许可证声明，以及柯影智航的 macOS/Windows 原生封装代码。它不包含 DeepSeek Harness 或其他上游项目的完整源代码、测试、内部文档、依赖目录或完整构建工程。

## 下载与安装

请在 [Releases](../../releases) 页面下载与操作系统匹配的安装包。

| 平台 | 文件名 | 架构 |
| --- | --- | --- |
| Windows | `Koying-Pilot-0.1.1-win-x64-setup.exe` | x64 |
| macOS | `Koying-Pilot-0.1.1.dmg` | Apple Silicon / Intel，取决于发行说明 |

Windows 安装器支持选择安装位置。当前 Windows 安装器未进行代码签名；请仅从本仓库的 Releases 页面下载，并在安装前核对 SHA-256 值。

## 校验安装包

每个 Release 都提供 `SHA256SUMS.txt`。在 Windows PowerShell 中运行：

```powershell
Get-FileHash .\Koying-Pilot-0.1.1-win-x64-setup.exe -Algorithm SHA256
```

在 macOS 终端中运行：

```sh
shasum -a 256 Koying-Pilot-0.1.1.dmg
```

## 上游致谢与独立性说明

柯影智航桌面版基于 DeepSeek Harness v0.1 进行独立封装。感谢 DeepSeek Harness、Cordis 及其开源贡献者提供的基础能力。

柯影智航不是 DeepSeek 的官方产品，也不受 DeepSeek 赞助或背书。DeepSeek 及相关名称、标识可能是其各自权利人的商标；本项目不主张任何商标权。

适用的上游许可证见 [LICENSE](LICENSE)，第三方组件声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 桌面封装代码

[desktop-wrapper](desktop-wrapper/README.md) 保留 macOS Cocoa/WKWebView 壳、Windows WinForms/WebView2 壳、安装器、平台清单、封装脚本和应用图标。该目录只包含桌面封装层；构建脚本依赖兼容的 DeepSeek Harness v0.1 源码工作区，因此不能在本仓库单独构建完整运行时。

## 使用与隐私

使用模型服务通常需要用户自行配置服务商凭据。请不要在 Issue、讨论区或日志中提交 API 密钥、访问令牌或其他敏感信息。

## 贡献与安全

请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献要求；安全问题请按 [SECURITY.md](SECURITY.md) 的方式反馈。
