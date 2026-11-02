/**
 * Phone normalisation, kept free of any server dependency.
 *
 * It lived in `@/lib/customer-identity`, which is server-only, so the admin form
 * could not check a number as it was typed. That module re-exports this one, so
 * every existing import keeps working.
 */

/**
 * Normalize a raw phone string to E.164 (`+<countrycode><number>`), or return
 * null when it can't be confidently normalized. Pure (no I/O).
 *
 * Rules (India-first, since this is an Indian store):
 *  - Strips spaces, dashes, parentheses, and a leading `00` international prefix.
 *  - `+<digits>` is kept as-is when it already looks like E.164.
 *  - A bare 10-digit Indian mobile (starting 6-9) gets the `+91` country code.
 *  - `91XXXXXXXXXX` (12 digits) is treated as India and prefixed with `+`.
 *  - Anything else that is a plausible 8–15 digit international number with a
 *    leading `+` is preserved; otherwise we return null rather than guess.
 */
export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Keep a single leading '+', drop every other non-digit.
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/[^\d]/g, "");

  // Drop an international '00' prefix (e.g. 0091...) — treat like a '+'.
  let plus = hasPlus;
  if (!plus && digits.startsWith("00")) {
    digits = digits.slice(2);
    plus = true;
  }

  if (digits.length === 0) return null;

  if (plus) {
    // Already international: validate length and return canonical form.
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }

  // No country code provided — apply India defaults.
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("0") && /^0[6-9]/.test(digits)) {
    // Domestic trunk-prefixed Indian mobile (0XXXXXXXXXX).
    return `+91${digits.slice(1)}`;
  }

  // Ambiguous / unsupported — caller decides what to do with a null.
  return null;
}

/**
 * A number an operator entered for a customer-targeted coupon, as E.164.
 *
 * Stricter than {@link normalizePhoneE164}, whose 8–15 digit allowance exists for
 * foreign numbers and so passes "+91 98765 4321" with a digit missing. On a
 * coupon that typo is silent: it saves, and the one customer it was meant for
 * can never redeem it.
 */
export function couponCustomerPhone(raw: string | null | undefined): string | null {
  const phone = normalizePhoneE164(raw);
  if (!phone) return null;
  if (phone.startsWith("+91") && !/^\+91[6-9]\d{9}$/.test(phone)) return null;
  return phone;
}

/**
 * What's wrong with each box of a number list, row for row, or null.
 *
 * A blank row is fine: it is the box the plus button just added. A repeat is
 * flagged on the later row, which is the one to remove.
 */
export function phoneRowProblems(rows: readonly string[]): (string | null)[] {
  const seen = new Set<string>();
  return rows.map((raw) => {
    if (!raw.trim()) return null;
    const phone = couponCustomerPhone(raw);
    if (!phone) return "Enter a valid mobile number";
    if (seen.has(phone)) return "This number is already on the list";
    seen.add(phone);
    return null;
  });
}

/** The usable numbers from a list of boxes, as de-duped E.164. */
export function phoneRowsToList(rows: readonly string[]): string[] {
  const phones = rows.map(couponCustomerPhone).filter((p): p is string => Boolean(p));
  return Array.from(new Set(phones));
}

export type CustomerPhonesRead =
  | { ok: true; phones: string[] | null | undefined }
  | { ok: false };

/**
 * The `customerPhones` list from an admin request, normalised and de-duped.
 *
 * Absent stays undefined (leave it alone) and null clears the restriction. An
 * empty or unusable list is refused rather than collapsed to null, because null
 * means "anyone": a list that lost its numbers must never widen a private code
 * to the whole base.
 */
export function readCustomerPhones(raw: unknown): CustomerPhonesRead {
  if (raw === undefined) return { ok: true, phones: undefined };
  if (raw === null) return { ok: true, phones: null };
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false };
  const phones = raw.map((v) => couponCustomerPhone(typeof v === "string" ? v : null));
  if (phones.some((p) => p === null)) return { ok: false };
  return { ok: true, phones: Array.from(new Set(phones as string[])) };
}
