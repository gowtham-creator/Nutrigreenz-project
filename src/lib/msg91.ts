import "server-only";

/**
 * Resolve the MSG91 account auth key from EITHER accepted env name.
 *
 * The code standardised on `MSG91_AUTH_KEY` (with underscore), but the
 * provisioned environment sets `MSG91_AUTHKEY` (no underscore) — so a correctly
 * provisioned key was silently inert and every SMS/WhatsApp send skipped. Accept
 * both names so either provisioning works, WITHOUT hardcoding the secret.
 * `MSG91_AUTH_KEY` (the documented name) wins when both are present.
 *
 * Read lazily at call time (never cached at module load) so setting the env in a
 * running deployment takes effect on the next request without a code change.
 */
export function msg91AuthKey(): string | undefined {
  return process.env.MSG91_AUTH_KEY ?? process.env.MSG91_AUTHKEY;
}
