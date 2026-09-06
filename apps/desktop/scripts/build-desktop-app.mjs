#!/usr/bin/env node

if (process.platform === 'darwin') {
  await import('./build-macos-app.mjs')
} else if (process.platform === 'win32') {
  await import('./build-windows-app.mjs')
} else {
  throw new Error('desktop build supports macOS and Windows')
}
