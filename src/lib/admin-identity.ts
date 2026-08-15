/**
 * Who the super admin is, and which addresses may be used to reach that
 * identity.
 *
 * ── Why aliases exist ─────────────────────────────────────────────────────
 *
 * The super admin's address changed from `admin@nutrigreenz.farm` to
 * `cubixso@nutrigreenz.farm`. A straight swap would have been the smaller
 * change, but two things are keyed by the email string rather than by a user
 * id: the `admin_security` row that holds the authenticator and OTP enrolment,
 * and every historical entry in the audit log. Renaming the identifier without
 * touching those would have signed the operator in as a stranger — no second
 * factor, and a history that appeared to belong to someone else.
 *
 * So there is ONE identity with a canonical address and a set of accepted
 * aliases. Any accepted address signs in; the session is always issued under
 * the canonical one. Downstream code never sees the alias, which is what keeps
 * the security row, the audit trail and the profile on a single key.
 *
 * ── Configuration ─────────────────────────────────────────────────────────
 *
 *   ADMIN_EMAIL          canonical address — what the console displays and what
 *                        every lookup is keyed on
 *   ADMIN_EMAIL_ALIASES  comma-separated addresses also accepted at sign-in
 *
 * Aliases are a sign-in convenience only. Removing one revokes that spelling
 * without disturbing the identity behind it.
 */

/** Canonical address if `ADMIN_EMAIL` is not configured. */
const DEFAULT_ADMIN_EMAIL = "cubixso@nutrigreenz.farm";

/**
 * Addresses that still work but are not the identity any more. Kept as a
 * built-in default rather than env-only so an existing deployment does not lock
 * its operator out the moment `ADMIN_EMAIL` is repointed and the alias variable
 * has not been added yet.
 */
const DEFAULT_ADMIN_EMAIL_ALIASES = ["admin@nutrigreenz.farm"];

const norm = (value: string): string => value.trim().toLowerCase();

/** The canonical super-admin address. Every lookup should be keyed on this. */
export function superAdminEmail(): string {
  return process.env.ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL;
}

/**
 * Every address that signs in as the super admin, canonical first, normalised
 * and de-duplicated. The canonical address is always included, so a malformed
 * alias list can never lock the operator out.
 */
export function superAdminAddresses(): string[] {
  const configured = process.env.ADMIN_EMAIL_ALIASES;
  const aliases = configured
    ? configured.split(",").map(norm).filter(Boolean)
    : DEFAULT_ADMIN_EMAIL_ALIASES.map(norm);
  return [...new Set([norm(superAdminEmail()), ...aliases])];
}

/**
 * Does this input address reach the super admin?
 *
 * Deliberately not timing-safe: an address is a username, not a secret, and the
 * passcode comparison beside this one already is. Making it constant-time would
 * suggest the address is confidential when it is printed in the console header.
 */
export function isSuperAdminAddress(input: string): boolean {
  return superAdminAddresses().includes(norm(input));
}

/**
 * Where mail addressed to an operator should actually be delivered.
 *
 * ── Why this indirection exists ───────────────────────────────────────────
 *
 * `nutrigreenz.farm` sends mail (through Brevo) but does not yet RECEIVE any —
 * there are no MX records, so no inbox exists at either super-admin address.
 * That is fine for a username, and fatal for a second factor: an email OTP sent
 * to `cubixso@nutrigreenz.farm` would bounce into nothing, and the operator
 * would be locked out by their own security setting.
 *
 * So delivery is separated from identity. The account is still keyed on the
 * canonical address — session, audit trail and security row are unchanged, and
 * the reset token is still minted for the address that was typed. Only the
 * envelope changes.
 *
 * ── Deliberately scoped to the super admin ────────────────────────────────
 *
 * The override applies ONLY to addresses that reach the super-admin identity.
 * A blanket redirect would route a staff operator's sign-in codes and password
 * resets into someone else's inbox — that is an account takeover primitive, not
 * a convenience, and it would do it silently.
 *
 * A per-admin `otp_email` set in the console still wins over this, because that
 * is an explicit choice about a specific account.
 *
 * TEMPORARY. Delete `ADMIN_MAILBOX_OVERRIDE` once nutrigreenz.farm has real
 * MX records and the mailbox accepts mail; the function then becomes identity.
 */
export function adminMailbox(email: string): string {
  const override = process.env.ADMIN_MAILBOX_OVERRIDE?.trim();
  if (override && isSuperAdminAddress(email)) return override;
  return email;
}
