# Agent Note: macOS 编辑菜单快捷键

Status: implemented

[English](2026-08-27-macos-edit-menu-shortcuts.md) | 中文

## Problem

macOS 原生壳只创建了应用菜单。`WKWebView` 仍可通过右键菜单执行剪贴板操作，但 AppKit 没有可将 Command-C、Command-V 和其他标准编辑快捷键路由到当前聚焦 Web 内容的主菜单操作。

## Decision

Cocoa 壳在应用菜单旁安装标准“编辑”菜单。其撤销、重做、剪切、复制、粘贴和全选菜单项使用 nil target，并分别使用 AppKit responder chain selector `undo:`、`redo:`、`cut:`、`copy:`、`paste:` 和 `selectAll:`。快捷键分别为 Command-Z、Shift-Command-Z、Command-X、Command-C、Command-V 和 Command-A。

target 保持为 nil，使 AppKit 可将每项操作交给 `WKWebView` 内的当前 first responder，包括普通字段、textarea 和可选中的 Web 内容。壳不调用浏览器剪贴板 API，也不注入 JavaScript 键盘处理器。

## Alternatives considered

**拦截键盘事件并调用浏览器剪贴板 API。** 拒绝：该方案会重复 AppKit 的聚焦与可编辑规则，引入浏览器剪贴板权限行为，并绕过右键菜单已使用的原生 responder chain。

**只添加复制和粘贴。** 拒绝：不完整的“编辑”菜单会让剪切、全选、撤销和重做仍然缺少原生快捷键分发。

## Consequences

当当前聚焦的 Web 内容支持相应操作时，桌面应用遵循 macOS 标准编辑快捷键。右键菜单编辑继续使用同一 `WKWebView` responder。macOS 专用源码测试会编译 Objective-C 启动器，并锁定菜单 selector 与快捷键；普通 Web 应用无需变更。
