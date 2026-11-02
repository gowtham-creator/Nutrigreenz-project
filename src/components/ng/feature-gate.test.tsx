// @vitest-environment jsdom
/**
 * FeatureGate only tidies links, so it must never take navigation away by
 * accident: it hides on an explicit "off" and on nothing else.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeatureGate } from "@/components/ng/feature-gate";

afterEach(cleanup);

const answer = (body: unknown, ok = true) =>
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, json: async () => body }));

const gate = (
  <FeatureGate feature="referrals">
    <a href="/referral">Refer &amp; earn</a>
  </FeatureGate>
);

/** Let the read settle, however it ends. */
const settled = () => waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

describe("FeatureGate", () => {
  it("shows the link while the feature is on", async () => {
    answer({ ok: true, flags: { referrals: true } });
    render(gate);
    await settled();
    expect(screen.getByText("Refer & earn")).toBeTruthy();
  });

  it("hides the link once the feature is off", async () => {
    answer({ ok: true, flags: { referrals: false } });
    render(gate);
    await waitFor(() => expect(screen.queryByText("Refer & earn")).toBeNull());
  });

  it("keeps the link when the flags cannot be read", async () => {
    answer({ ok: false }, false);
    render(gate);
    await settled();
    expect(screen.getByText("Refer & earn")).toBeTruthy();
  });

  it("keeps the link when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(gate);
    await settled();
    expect(screen.getByText("Refer & earn")).toBeTruthy();
  });

  it("keeps the link when the flag is absent from the answer", async () => {
    answer({ ok: true, flags: {} });
    render(gate);
    await settled();
    expect(screen.getByText("Refer & earn")).toBeTruthy();
  });
});
