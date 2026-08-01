import "server-only";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";

/**
 * Who may be sent a marketing campaign, and on which channels.
 *
 * The previous broadcast selected every customer row and messaged all of them.
 * There was no consent flag to check, no unsubscribe to honour, and no record
 * afterwards — so nobody could answer "who did we message, and did they agree".
 *
 * Channels are resolved PER CUSTOMER, not per campaign: a customer with only a
 * phone gets SMS, one with only an email gets email, one with both gets both,
 * and either channel drops out the moment they opt out of it.
 */

export interface Recipient {
  customerId: string;
  name: string | null;
  /** Present only when they have an email AND have not opted out of email. */
  email: string | null;
  /** Present only when they have a phone AND have not opted out of SMS. */
  phone: string | null;
  /** Their unsubscribe secret, for the link in the email footer. */
  unsubscribeToken: string;
}

export class ConsentColumnsMissing extends Error {
  constructor() {
    super("marketing-consent-columns-missing");
    this.name = "ConsentColumnsMissing";
  }
}

interface Row {
  id: string;
  display_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  marketing_email_opt_out: boolean | null;
  marketing_sms_opt_out: boolean | null;
  unsubscribe_token: string;
}

/**
 * Every customer who may receive marketing, with their permitted channels.
 *
 * Throws {@link ConsentColumnsMissing} when the consent migration has not been
 * applied. That is deliberate: without those columns every row looks like
 * consent, and the failure mode of guessing wrong is messaging the entire
 * customer base without permission. Refusing to send is the recoverable error.
 */
export async function marketingAudience(): Promise<Recipient[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabaseAdmin()
    .from("customers")
    .select(
      "id, display_name, primary_email, primary_phone, marketing_email_opt_out, marketing_sms_opt_out, unsubscribe_token",
    )
    // Merged duplicates would double-message one real person.
    .is("merged_into", null);

  if (error) {
    // Postgres 42703 = undefined_column; anything else is a genuine failure.
    if (error.code === "42703" || /column .* does not exist/i.test(error.message)) {
      throw new ConsentColumnsMissing();
    }
    throw new Error(error.message);
  }

  const out: Recipient[] = [];
  for (const r of (data ?? []) as Row[]) {
    const email = r.primary_email && !r.marketing_email_opt_out ? r.primary_email : null;
    const phone = r.primary_phone && !r.marketing_sms_opt_out ? r.primary_phone : null;
    // A customer reachable on no channel is not an audience member. Counting
    // them would inflate "audience" with people who cannot receive anything.
    if (!email && !phone) continue;
    out.push({
      customerId: r.id,
      name: r.display_name,
      email,
      phone,
      unsubscribeToken: r.unsubscribe_token,
    });
  }
  return out;
}

/**
 * Opt a customer out, by unsubscribe token.
 *
 * Returns false for an unknown token rather than throwing, so the public
 * unsubscribe page can show the same confirmation either way — an attacker
 * probing tokens learns nothing, and a customer clicking an old link is not
 * told their unsubscribe failed.
 */
export async function unsubscribeByToken(
  token: string,
  channels: { email?: boolean; sms?: boolean } = { email: true, sms: true },
): Promise<boolean> {
  if (!isSupabaseConfigured || !token) return false;

  const patch: Record<string, unknown> = { marketing_opt_out_at: new Date().toISOString() };
  if (channels.email) patch.marketing_email_opt_out = true;
  if (channels.sms) patch.marketing_sms_opt_out = true;

  const { data, error } = await supabaseAdmin()
    .from("customers")
    .update(patch)
    .eq("unsubscribe_token", token)
    .select("id")
    .maybeSingle();

  return !error && Boolean(data);
}
