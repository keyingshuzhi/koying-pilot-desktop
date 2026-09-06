# dsh-client-ui-about

English | [中文](README.zh.md)

The Koying Pilot product-identity and acknowledgements plugin. The desktop bundle mounts its page as a late Settings section, where it identifies the product, attributes the Koying Digital Intelligence development team, thanks the upstream and open-source projects used by the distribution, and states that model credentials are configured locally rather than embedded in the installer. It also sets the browser document title and replaces the shared sidebar artwork with the Koying Pilot name and monogram through semantic brand hooks exposed by the shared primitives.

The page is static presentation. It reads no Host data, exposes no action, and registers only after the Settings shell declares `settings.section`; disposal removes the page and both locale dictionaries, restores the previous document title, and removes the product marker.

## Model Experience

None, as the browser-only attribution page adds no model context.

#### KV Cache effect

None; the package adds nothing to model requests.

## Known Limitations and Deferred Work

- Product version and acknowledgements are compile-time copy; a release that changes either must rebuild the client bundle.
- The sidebar identity is text and CSS presentation; the native application icon remains the packaged `.icns` asset.
