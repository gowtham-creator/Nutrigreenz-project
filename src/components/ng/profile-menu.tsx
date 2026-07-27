"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AccountAvatar } from "./account-avatar";

/**
 * Header profile control. A single icon button that opens a dropdown:
 *   - signed in  → name/email + "View profile" + "Sign out"
 *   - signed out → "Sign in" (carries the current path so auth returns you here)
 * Closes on outside-click, Escape, and route change.
 */
export function ProfileMenu() {
  const { isAuthed, account, signOutUser } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const signInHref = `/auth?next=${encodeURIComponent(pathname || "/")}`;

  async function handleSignOut() {
    setOpen(false);
    await signOutUser();
    router.push("/");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={isAuthed ? "Account menu" : "Sign in"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 md:h-10 md:w-10 items-center justify-center rounded-full hover:bg-ng-forest/[0.06] transition-colors text-ng-ink"
      >
        {isAuthed ? (
          <AccountAvatar
            name={account?.name}
            photoURL={account?.photoURL}
            size={28}
            fallback="G"
          />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
          </svg>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-ng-line bg-ng-paper shadow-[var(--shadow-ng-float)] p-2 z-50"
        >
          {isAuthed ? (
            <>
              <div className="px-3 py-2.5 mb-1 border-b border-ng-line-soft">
                <div className="font-display text-[15px] text-ng-forest-deep truncate">
                  {account?.name?.trim() || "Your account"}
                </div>
                {account?.email ? (
                  <div className="text-[12px] text-ng-ink-soft truncate">{account.email}</div>
                ) : account?.phone ? (
                  <div className="text-[12px] text-ng-ink-soft truncate">{account.phone}</div>
                ) : null}
              </div>
              <Link
                href="/account"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-medium text-ng-ink hover:bg-ng-forest/[0.06] hover:text-ng-forest-deep transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></svg>
                View profile
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-medium text-ng-clay-deep hover:bg-ng-clay/10 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
                Sign out
              </button>
            </>
          ) : (
            <Link
              href={signInHref}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-medium text-ng-ink hover:bg-ng-forest/[0.06] hover:text-ng-forest-deep transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></svg>
              Sign in
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
