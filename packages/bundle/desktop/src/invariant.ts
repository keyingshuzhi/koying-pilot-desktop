/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-desktop`.
 * @module @deepseek-ai/dsh-desktop/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-desktop'

/** Cordis companion plugin name. */
export const name = 'desktop-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

/** No runtime relation exists: the package's owned behavior is static profile composition. */
const install: InvariantInstaller = () => {}

/**
 * Register the package's empty invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
