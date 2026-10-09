/**
 * Our order number as SBIePay's `orderRefNumber`.
 *
 * LIVE accepts letters and digits only, up to 50 characters (error 2002
 * "orderRefNumber is invalid. Reason : Format is incorrect" for "NG-26-1042";
 * the sandbox accepted the hyphens). So "NG-26-1042" is sent as "NG261042".
 * Every place that sends or matches the reference goes through this, so the
 * two sides can never disagree.
 */
export function toSbiepayRef(orderNumber: string): string {
  return orderNumber.replace(/[^A-Za-z0-9]/g, "").slice(0, 50);
}

/**
 * Back from SBI's reference to our order number: "NG261042" -> "NG-26-1042".
 * Anything that is not in that shape (an old hyphenated reference, or an id)
 * is returned unchanged, so lookups by either form keep working.
 */
export function fromSbiepayRef(ref: string): string {
  const m = /^NG(\d{2})([A-Za-z0-9]+)$/.exec(ref.trim());
  return m ? `NG-${m[1]}-${m[2]}` : ref.trim();
}
