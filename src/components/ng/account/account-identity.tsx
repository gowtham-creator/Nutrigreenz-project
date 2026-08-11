"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { BrandIcon } from "@/components/ui/brand-icon";
import { useAuth } from "@/lib/auth";
import { AccountAvatar } from "@/components/ng/account-avatar";

/** Format a member-since ISO date as e.g. "Aug 2025". */
function memberSinceLabel(iso?: string): string {
  if (!iso) return "since 2025";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "since 2025";
  return `since ${d.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`;
}

/**
 * The account sidebar identity card. Reads the persisted account so the name
 * and avatar initial reflect the signed-in user (real or demo). Falls back to a
 * generic label when signed out. Kept as a small client island so the rest of
 * `AccountShell` can stay a server component.
 */
export function AccountIdentity() {
  const { account, isAuthed } = useAuth();

  const name = isAuthed ? (account?.name?.trim() || "Your account") : "Guest";
  const sub = isAuthed
    ? `Member · ${memberSinceLabel(account?.memberSince)}`
    : "Not signed in";

  return (
    <div className="mb-4 flex items-center gap-3.5 rounded-2xl border border-ng-line-soft bg-ng-paper/80 p-4 shadow-[var(--shadow-ng-card)] backdrop-blur-sm">
      <div className="relative shrink-0">
        <AccountAvatar
          name={isAuthed ? account?.name : "Guest"}
          photoURL={isAuthed ? account?.photoURL : null}
          size={48}
          fallback="G"
          className="ring-ng-leaf/40"
        />
        {isAuthed ? (
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 grid h-4.5 w-4.5 place-items-center rounded-full bg-ng-paper text-ng-leaf ring-1 ring-ng-leaf/30"
          >
            <Icon name="leaf-bold" size={11} />
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="truncate font-display text-[15px] leading-tight text-ng-forest-deep">{name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ng-ink-soft">
          {isAuthed ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-ng-green-bright" aria-hidden /> : null}
          <span className="truncate">{sub}</span>
        </div>
      </div>
    </div>
  );
}

/** Sign-out action for the account sidebar: clears the account, then routes to /auth. */
export function SignOutButton() {
  const router = useRouter();
  const { signOutUser } = useAuth();
  return (
    <button
      type="button"
      onClick={async () => {
        await signOutUser();
        router.push("/auth");
      }}
      className="flex min-h-[44px] items-center gap-2.5 whitespace-nowrap rounded-xl px-4 py-3 text-left text-[14px] font-medium text-ng-danger transition-colors hover:bg-ng-danger/10 lg:mt-2"
    >
      <BrandIcon name="signOut" weight="solid" size={18} />
      Sign out
    </button>
  );
}
