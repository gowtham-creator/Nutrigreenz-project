import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { plainText, TEXT_LIMITS } from "@/lib/sanitize-text";

/**
 * Reading and writing the profile fields the account page collects.
 *
 * ── The one thing to be careful about ─────────────────────────────────────
 *
 * Consent is stored as OPT-OUT (`marketing_email_opt_out`) and displayed as
 * OPT-IN ("Email me offers"). The inversion happens here and nowhere else.
 *
 * That is not tidiness. The campaign sender reads the opt-out columns directly,
 * so a second place that flips the sense — or forgets to — produces a customer
 * who has switched marketing off in their profile and still receives it. There
 * is no error, no log line, and the first sign is a complaint. Keeping the
 * translation in one function means the bug cannot be introduced by editing a
 * page component.
 */

/** What the account page shows: true means "yes, contact me". */
export interface NotificationPrefs {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  /** Transactional. A customer who wants no offers still needs delivery news. */
  orders: boolean;
}

export interface CustomerProfile {
  name: string | null;
  email: string | null;
  phone: string | null;
  /** ISO date (yyyy-mm-dd), or null. */
  dob: string | null;
  gender: string | null;
  dietPrefs: string[];
  notify: NotificationPrefs;
}

export type CustomerProfilePatch = Partial<
  Omit<CustomerProfile, "phone" | "notify">
> & {
  notify?: Partial<NotificationPrefs>;
};

/** Values the `customers_gender_chk` constraint accepts. */
const GENDERS = new Set(["female", "male", "other", "prefer_not_to_say"]);

const SELECT =
  "display_name, primary_email, primary_phone, dob, gender, diet_prefs, " +
  "marketing_email_opt_out, marketing_sms_opt_out, marketing_whatsapp_opt_out, " +
  "notify_order_updates";

interface Row {
  display_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  dob: string | null;
  gender: string | null;
  diet_prefs: string[] | null;
  marketing_email_opt_out: boolean | null;
  marketing_sms_opt_out: boolean | null;
  marketing_whatsapp_opt_out: boolean | null;
  notify_order_updates: boolean | null;
}

function toProfile(row: Row): CustomerProfile {
  return {
    name: row.display_name,
    email: row.primary_email,
    phone: row.primary_phone,
    dob: row.dob,
    gender: row.gender,
    dietPrefs: row.diet_prefs ?? [],
    notify: {
      // The single inversion point. See the note at the top of this file.
      email: !row.marketing_email_opt_out,
      sms: !row.marketing_sms_opt_out,
      whatsapp: !row.marketing_whatsapp_opt_out,
      orders: row.notify_order_updates ?? true,
    },
  };
}

export async function getCustomerProfile(customerId: string): Promise<CustomerProfile | null> {
  const { data } = await supabaseAdmin()
    .from("customers")
    .select(SELECT)
    .eq("id", customerId)
    .maybeSingle();
  return data ? toProfile(data as unknown as Row) : null;
}

/** Rejected input, named so the caller can tell the customer which field. */
export class ProfileValidationError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "ProfileValidationError";
  }
}

/**
 * Apply a partial update.
 *
 * Only fields present in the patch are written, so a page that renders half the
 * form cannot blank the other half by omission.
 */
export async function updateCustomerProfile(
  customerId: string,
  patch: CustomerProfilePatch,
): Promise<CustomerProfile> {
  const update: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    /*
     * Stripped BEFORE the length check, so the limit measures the name rather
     * than the markup around it. The ceiling was already enforced here — this
     * adds the tag/brace/bidi cleaning the rest of the API applies, because a
     * display name travels well beyond HTML: it is interpolated into order
     * emails, invoices and WhatsApp messages, none of which escape.
     */
    const name = plainText(patch.name, TEXT_LIMITS.name + 1);
    if (name.length > TEXT_LIMITS.name) {
      throw new ProfileValidationError("name", "Name is too long (120 characters maximum).");
    }
    update.display_name = name || null;
  }

  if (patch.email !== undefined) {
    const email = patch.email?.trim().toLowerCase() ?? "";
    // Deliberately permissive: the authoritative check is the verification mail.
    // Rejecting unusual-but-valid addresses here would lock people out of their
    // own profile over a regex.
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new ProfileValidationError("email", "That does not look like an email address.");
    }
    if (email.length > 254) {
      throw new ProfileValidationError("email", "Email address is too long.");
    }
    update.primary_email = email || null;
  }

  if (patch.dob !== undefined) {
    const dob = patch.dob?.trim() ?? "";
    if (dob) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
        throw new ProfileValidationError("dob", "Date of birth must be a valid date.");
      }
      const when = new Date(`${dob}T00:00:00Z`);
      if (Number.isNaN(when.getTime())) {
        throw new ProfileValidationError("dob", "Date of birth must be a valid date.");
      }
      // A future birth date is a typo every time, and it would quietly poison
      // any age-based segmentation built on this column later.
      if (when.getTime() > Date.now()) {
        throw new ProfileValidationError("dob", "Date of birth cannot be in the future.");
      }
    }
    update.dob = dob || null;
  }

  if (patch.gender !== undefined) {
    const gender = patch.gender?.trim() ?? "";
    if (gender && !GENDERS.has(gender)) {
      throw new ProfileValidationError("gender", "Unrecognised value.");
    }
    update.gender = gender || null;
  }

  if (patch.dietPrefs !== undefined) {
    const prefs = (patch.dietPrefs ?? [])
      .map((d) => String(d).trim())
      .filter(Boolean)
      .slice(0, 12);
    if (prefs.some((d) => d.length > 40)) {
      throw new ProfileValidationError("dietPrefs", "One of those preferences is too long.");
    }
    update.diet_prefs = prefs;
  }

  if (patch.notify) {
    const n = patch.notify;
    // Inverted here, matching toProfile above — the only other place that knows
    // these columns are stored as opt-outs.
    if (n.email !== undefined) update.marketing_email_opt_out = !n.email;
    if (n.sms !== undefined) update.marketing_sms_opt_out = !n.sms;
    if (n.whatsapp !== undefined) update.marketing_whatsapp_opt_out = !n.whatsapp;
    if (n.orders !== undefined) update.notify_order_updates = n.orders;
  }

  if (Object.keys(update).length === 0) {
    const current = await getCustomerProfile(customerId);
    if (!current) throw new Error("customer-not-found");
    return current;
  }

  update.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin()
    .from("customers")
    .update(update)
    .eq("id", customerId)
    .select(SELECT)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("customer-not-found");
  return toProfile(data as unknown as Row);
}
