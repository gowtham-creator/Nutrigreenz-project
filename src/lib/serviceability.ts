/**
 * Client-side serviceability check. Calls the public
 * `GET /api/commerce-rules/serviceable?pincode=` endpoint, which is backed by the
 * Super Admin `serviceable_areas` list.
 *
 * Fails OPEN: on a malformed response or network error it returns `true`, so a
 * flaky check never wrongly blocks a customer from checking out. The authoritative
 * (fail-closed) decision still lives server-side; this is the UI signal.
 */
export async function fetchServiceable(pincode: string): Promise<boolean> {
  const pin = (pincode ?? "").trim();
  if (!/^\d{6}$/.test(pin)) return true;
  try {
    const res = await fetch(
      `/api/commerce-rules/serviceable?pincode=${encodeURIComponent(pin)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return true;
    const data = (await res.json()) as { ok?: boolean; serviceable?: boolean };
    return data?.ok ? Boolean(data.serviceable) : true;
  } catch {
    return true;
  }
}
