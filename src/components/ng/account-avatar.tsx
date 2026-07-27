"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Initials for an avatar fallback: the first letter of the first name and the
 * first letter of the last name, capitalised — "Gowtham Reddy" → "GR". A
 * single-word name yields one letter; middle names are ignored.
 */
export function initialsFromName(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/**
 * The signed-in customer's avatar: their Google profile photo when one is
 * available, otherwise their initials on the brand gradient. Falls back to
 * initials automatically if the remote photo fails to load (Google URLs can
 * expire), so the avatar never renders as a broken image.
 */
export function AccountAvatar({
  name,
  photoURL,
  size = 28,
  className,
  fallback = "",
}: {
  name?: string | null;
  photoURL?: string | null;
  /** Rendered pixel size of the (square) avatar. */
  size?: number;
  className?: string;
  /** Shown when there is no photo and no usable name. */
  fallback?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = initialsFromName(name) || fallback;

  if (photoURL && !failed) {
    return (
      <Image
        src={photoURL}
        alt={name?.trim() ? `${name.trim()} profile photo` : "Profile photo"}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={cn("shrink-0 rounded-full object-cover", className)}
        // Google avatar URLs are already sized and served from their CDN.
        unoptimized
      />
    );
  }

  return (
    <span
      aria-hidden={!initials}
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-ng-leaf/30 to-ng-sage font-display font-semibold text-ng-forest-deep ring-1 ring-inset ring-ng-forest/20",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.42)) }}
    >
      {initials}
    </span>
  );
}
