"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { FeatureFlagKey } from "@/lib/feature-flags";

/**
 * Hide a link to a feature that is switched off.
 *
 * This is tidiness, not enforcement: the feature's own pages and APIs refuse
 * for themselves on the server (`isFeatureEnabled`). It exists so a shell shared
 * by server and client pages can drop a link it cannot read a flag for directly.
 *
 * Starts on, and stays on if the read fails, so a slow or failed request costs
 * a link that goes nowhere rather than removing navigation for everyone. In the
 * common case, when the feature is on, nothing on screen moves.
 */
export function useFeatureFlag(feature: FeatureFlagKey): boolean {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let alive = true;
    void fetch("/api/feature-flags", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ flags?: Record<string, boolean> }>) : null))
      .then((data) => {
        if (alive && data?.flags?.[feature] === false) setEnabled(false);
      })
      .catch(() => {
        /* keep it on: see above */
      });
    return () => {
      alive = false;
    };
  }, [feature]);

  return enabled;
}

export function FeatureGate({ feature, children }: { feature: FeatureFlagKey; children: ReactNode }) {
  return useFeatureFlag(feature) ? children : null;
}
