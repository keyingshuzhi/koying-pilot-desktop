/**
 * The desktop bundle's product contribution is fully expressed by its Cordis
 * patch. This standard plugin export keeps the package compatible with
 * workspace build and package-validation tooling; profile composition does not
 * mount it.
 *
 * @module @deepseek-ai/dsh-desktop
 */

import type { Context } from '@deepseek-ai/cordis'

/** Stable Cordis plugin name for explicit mounts outside profile composition. */
export const name = 'desktop-bundle'

/** Mount the bundle's empty runtime plugin. @param _ctx - unused plugin context. */
export function apply(_ctx: Context): void {}
