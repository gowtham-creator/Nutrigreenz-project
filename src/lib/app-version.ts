/**
 * The console's version badge, in one place.
 *
 * This string was hardcoded in four files — the sidebar and the three auth
 * screens — which is exactly why it sat at v0.4.1 long after it stopped being
 * true. A version that has to be remembered in four places is a version that
 * goes stale.
 *
 * ── Why not read package.json ─────────────────────────────────────────────
 *
 * That was the first instinct, and it is wrong here: package.json is at 0.1.0
 * and is the NPM package version, which nothing has been maintaining either.
 * Importing it would also pull a JSON file into the client bundle to render
 * eleven characters. This is the product version, which is a different number
 * with a different audience — operators, not npm.
 *
 * Bump it here when the console ships something an operator would notice.
 */
export const ADMIN_VERSION = "v1.0.0";

/** Rendered form, e.g. "Admin · v1.0.0". */
export const ADMIN_VERSION_LABEL = `Admin · ${ADMIN_VERSION}`;
