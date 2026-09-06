# Agent Note: macOS edit-menu keyboard shortcuts

Status: implemented

English | [中文](2026-08-27-macos-edit-menu-shortcuts.zh.md)

## Problem

The native macOS shell created only the application menu. `WKWebView` still exposed clipboard actions through its contextual menu, but AppKit had no main-menu actions through which it could route Command-C, Command-V, and the other standard editing key equivalents to the focused Web content.

## Decision

The Cocoa shell installs a standard Edit menu beside the application menu. Its Undo, Redo, Cut, Copy, Paste, and Select All items use nil targets with the AppKit responder-chain selectors `undo:`, `redo:`, `cut:`, `copy:`, `paste:`, and `selectAll:`. Their key equivalents are Command-Z, Shift-Command-Z, Command-X, Command-C, Command-V, and Command-A.

Keeping the targets nil lets AppKit resolve each action against the current first responder inside `WKWebView`, including ordinary fields, textareas, and selectable Web content. The shell does not call browser clipboard APIs or inject JavaScript keyboard handlers.

## Alternatives considered

**Intercept keyboard events and call browser clipboard APIs.** Rejected because it would duplicate AppKit focus and editability rules, introduce browser clipboard-permission behavior, and bypass the native responder chain already used by the contextual menu.

**Add only Copy and Paste.** Rejected because a partial Edit menu would leave the same native dispatch gap for Cut, Select All, Undo, and Redo.

## Consequences

The desktop application follows the standard macOS editing shortcuts wherever the focused Web content supports the corresponding action. Contextual-menu editing continues to use the same `WKWebView` responder. A macOS-only source test compiles the Objective-C launcher and pins the menu selectors and key equivalents; the ordinary Web application requires no change.
