"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  reauthenticateWithPopup,
  signOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type User,
  type ConfirmationResult,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { runGoogleEnrich, type GoogleEnrichDetail } from "@/lib/google-enrich-client";
import { otpProvider } from "@/lib/otp-provider";

const NOT_CONFIGURED =
  "Authentication isn't configured yet. Add your Firebase keys to .env.local.";

const ACCOUNT_KEY = "ng.account.v1";

/**
 * A unified, persisted account that works in BOTH real-Firebase and demo modes.
 * Stored in localStorage under `ng.account.v1` so a session (and any profile
 * edits) survive reloads regardless of whether Firebase keys are present.
 */
export interface NgAccount {
  /** Firebase UID — ties a stored profile to one specific account (real mode). */
  uid?: string;
  name: string;
  email: string;
  /** Phone in E.164/display form, e.g. "+919876543210". */
  phone: string;
  photoURL?: string;
  method: "google" | "phone" | "demo";
  /** ISO timestamp of when the account was first created. */
  memberSince: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** Whether Firebase is configured; UI can show a demo notice when false. */
  configured: boolean;
  /** The persisted, unified account (real or demo). `null` when signed out. */
  account: NgAccount | null;
  /** Convenience flag: `account != null`. */
  isAuthed: boolean;
  /** Merge a patch into the current account and persist it. */
  updateProfile: (patch: Partial<NgAccount>) => void;
  /** Google Sign-In (real popup when configured, demo account otherwise). */
  signInWithGoogle: () => Promise<void>;
  /**
   * On-demand re-import of the signed-in Google account's profile data
   * (addresses + phone) via a fresh consent popup — independent of the
   * sign-in-time enrichment. Resolves with the enrich outcome, or null when
   * nothing was imported / the popup was dismissed.
   */
  importGoogleProfile: () => Promise<GoogleEnrichDetail | null>;
  /** Send an SMS OTP to a phone number (E.164, e.g. "+9198XXXXXXXX"). */
  sendOtp: (phone: string, recaptchaContainerId?: string) => Promise<void>;
  /** Confirm the SMS OTP code; resolves the session. */
  verifyOtp: (code: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isNgAccount(value: unknown): value is NgAccount {
  if (typeof value !== "object" || value === null) return false;
  const a = value as NgAccount;
  return (
    typeof a.name === "string" &&
    typeof a.email === "string" &&
    typeof a.phone === "string" &&
    (a.method === "google" || a.method === "phone" || a.method === "demo") &&
    typeof a.memberSince === "string"
  );
}

function readStoredAccount(): NgAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isNgAccount(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Build an account snapshot from a Firebase user, merged with saved edits. */
function accountFromUser(user: User, saved: NgAccount | null): NgAccount {
  const base: NgAccount = {
    uid: user.uid,
    name: user.displayName ?? "",
    email: user.email ?? "",
    phone: user.phoneNumber ?? "",
    photoURL: user.photoURL ?? undefined,
    method: user.phoneNumber && !user.email ? "phone" : "google",
    memberSince: new Date().toISOString(),
  };
  // Carry over saved edits ONLY when they belong to the SAME Firebase user, so
  // one account's profile can never bleed onto a different signed-in account.
  if (!saved || saved.uid !== user.uid) return base;
  return {
    ...base,
    name: saved.name || base.name,
    email: saved.email || base.email,
    phone: saved.phone || base.phone,
    photoURL: saved.photoURL ?? base.photoURL,
    method: saved.method ?? base.method,
    memberSince: saved.memberSince,
  };
}

/**
 * Sync a client Firebase sign-in to the server: POST the Firebase ID token to
 * /api/auth/session, which verifies it, upserts the user row in Supabase and
 * sets the signed httpOnly `ng_session` cookie. Best-effort — a failure here
 * never blocks the already-established client session.
 */
async function syncServerSession(u: User): Promise<void> {
  try {
    const idToken = await u.getIdToken();
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
  } catch {
    /* best-effort */
  }
}

/** Clear the server session cookie on sign-out. Best-effort. */
async function clearServerSession(): Promise<void> {
  try {
    await fetch("/api/auth/session", { method: "DELETE" });
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<NgAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Holds the live Firebase ConfirmationResult OR, in demo mode, the pending phone.
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const pendingPhoneRef = useRef<string | null>(null);
  // One reused reCAPTCHA verifier — cleared before every (re)send so a "Resend
  // code" tap never double-renders into the same container.
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  // Hydrate the persisted account after mount (SSR-safe; mirrors cart.tsx).
  useEffect(() => {
    setAccount(readStoredAccount());
    setHydrated(true);
  }, []);

  // Persist whenever the account changes (only after initial hydration).
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      if (account) {
        window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
      } else {
        window.localStorage.removeItem(ACCOUNT_KEY);
      }
    } catch {
      /* quota / private-mode — fail silently */
    }
  }, [account, hydrated]);

  // Real Firebase: derive the account from auth state, merged with saved edits.
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setAccount((prev) => accountFromUser(u, prev ?? readStoredAccount()));
        // Mirror the sign-in to the server (upsert user + set ng_session cookie).
        void syncServerSession(u);
      } else {
        // In MSG91 mode a phone sign-in has NO Firebase user, so this listener
        // fires with `u = null` on load — don't let it wipe that server-backed
        // phone session. Google sign-out (method "google") still clears normally.
        // In the default Firebase mode this is an unconditional clear (unchanged).
        setAccount((prev) =>
          prev && prev.method === "phone" && otpProvider() === "msg91" ? prev : null,
        );
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Demo mode never has a Firebase listener, so settle `loading` once hydrated.
  useEffect(() => {
    if (!auth && hydrated) setLoading(false);
  }, [hydrated]);

  const updateProfile = useCallback((patch: Partial<NgAccount>) => {
    setAccount((prev) => {
      const base: NgAccount =
        prev ?? {
          name: "",
          email: "",
          phone: "",
          method: "demo",
          memberSince: new Date().toISOString(),
        };
      return { ...base, ...patch };
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) {
      // DEMO: synthesise a Google account and persist.
      setAccount({
        name: "Ananya Rao",
        email: "ananya.rao@gmail.com",
        phone: "",
        photoURL: undefined,
        method: "google",
        memberSince: new Date().toISOString(),
      });
      return;
    }
    const provider = new GoogleAuthProvider();
    /*
     * People API scopes are OFF unless explicitly enabled.
     *
     * These were requested on every sign-in on the reasoning that they are
     * additive: the user could decline the checkboxes and still sign in. That
     * reasoning holds for DENIAL, and it is not the failure that happened.
     *
     * `user.phonenumbers.read` and `user.addresses.read` are SENSITIVE scopes.
     * When the OAuth consent screen is not verified for them, or the project
     * drops out of Testing, Google rejects the authorisation request outright
     * with "The requested action is invalid" — before any consent screen is
     * shown and with no way for the user to proceed. Sign-in does not degrade,
     * it stops entirely, which is what took Google login down in production.
     *
     * So the default is now plain sign-in, which needs no verification and
     * cannot be rejected this way. Enrichment stays available through the
     * explicit "import from Google" action below, where a rejection is
     * contained to the feature the customer just asked for rather than
     * standing between them and their account.
     *
     * Set NEXT_PUBLIC_GOOGLE_PEOPLE_SCOPES=1 to restore them once the consent
     * screen is verified for both scopes.
     */
    if (process.env.NEXT_PUBLIC_GOOGLE_PEOPLE_SCOPES === "1") {
      provider.addScope("https://www.googleapis.com/auth/user.phonenumbers.read");
      provider.addScope("https://www.googleapis.com/auth/user.addresses.read");
    }
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(auth, provider);
    // onAuthStateChanged populates `account`. Separately, capture the Google OAuth
    // ACCESS token and best-effort enrich (own addresses + takeover-safe phone).
    // Wrapped so a People-API hiccup can never reject the (successful) sign-in.
    try {
      const accessToken =
        GoogleAuthProvider.credentialFromResult(result)?.accessToken ?? null;
      void runGoogleEnrich(accessToken);
    } catch {
      /* best-effort — sign-in already succeeded */
    }
  }, []);

  const importGoogleProfile = useCallback(async (): Promise<GoogleEnrichDetail | null> => {
    if (!auth?.currentUser) return null;
    const provider = new GoogleAuthProvider();
    /* The sensitive scopes stay HERE, on the explicit import action. If Google
       rejects them the customer loses an optional convenience they just asked
       for, and the catch below returns null. They are already signed in, so
       nothing about their account is at risk. */
    provider.addScope("https://www.googleapis.com/auth/user.phonenumbers.read");
    provider.addScope("https://www.googleapis.com/auth/user.addresses.read");
    // Force the consent screen to re-appear: Google REMEMBERS a previously
    // unticked sensitive scope and silently omits it forever otherwise. This
    // gives the user a fresh chance to grant the address/phone checkboxes.
    provider.setCustomParameters({ prompt: "consent" });
    try {
      // Re-consent against the SAME account — yields a fresh OAuth access token
      // whenever the user asks, with no dependence on sign-in timing.
      const result = await reauthenticateWithPopup(auth.currentUser, provider);
      const accessToken =
        GoogleAuthProvider.credentialFromResult(result)?.accessToken ?? null;
      return await runGoogleEnrich(accessToken);
    } catch {
      // Popup closed / scope denied — nothing imported.
      return null;
    }
  }, []);

  const sendOtp = useCallback(
    async (phone: string, recaptchaContainerId = "recaptcha-container") => {
      if (otpProvider() === "msg91") {
        // MSG91: no Firebase SDK / no reCAPTCHA — the server texts the code.
        pendingPhoneRef.current = phone;
        const res = await fetch("/api/auth/otp/send", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(
            res.status === 429
              ? "Too many attempts. Please wait a few minutes and try again."
              : data.error === "SMS OTP not configured"
                ? "SMS sign-in isn't configured yet."
                : "Couldn't send the code",
          );
        }
        return;
      }
      if (!auth) {
        // DEMO: no network — just remember the phone we'll "verify".
        pendingPhoneRef.current = phone;
        return;
      }
      // reCAPTCHA tokens are single-use: drop any prior verifier before minting a
      // fresh one so the second send (Resend) can't hit "already rendered".
      verifierRef.current?.clear();
      const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
        size: "invisible",
      });
      verifierRef.current = verifier;
      try {
        confirmationRef.current = await signInWithPhoneNumber(auth, phone, verifier);
      } catch (err) {
        // A failed send leaves a spent widget — clear it so the retry is clean.
        verifierRef.current?.clear();
        verifierRef.current = null;
        throw err;
      }
    },
    [],
  );

  const verifyOtp = useCallback(async (code: string) => {
    if (otpProvider() === "msg91") {
      // MSG91: the server verifies the code and sets the httpOnly ng_session
      // cookie; we mirror it into a local phone account (as demo mode does) so
      // `isAuthed` flips and the UI updates without a Firebase user.
      if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code");
      const phone = pendingPhoneRef.current;
      if (!phone) throw new Error("Request a code first");
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      if (!res.ok) throw new Error("Invalid or expired code");
      setAccount({
        name: "",
        email: "",
        phone,
        method: "phone",
        memberSince: new Date().toISOString(),
      });
      pendingPhoneRef.current = null;
      return;
    }
    if (!auth) {
      // DEMO: accept any 6-digit code; create a phone account (empty name → user
      // completes it on the profile page).
      if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code");
      const phone = pendingPhoneRef.current;
      if (!phone) throw new Error("Request a code first");
      setAccount({
        name: "",
        email: "",
        phone,
        method: "phone",
        memberSince: new Date().toISOString(),
      });
      pendingPhoneRef.current = null;
      return;
    }
    const confirmation = confirmationRef.current;
    if (!confirmation) throw new Error("Request a code first");
    await confirmation.confirm(code);
    confirmationRef.current = null;
    // onAuthStateChanged populates `account`.
  }, []);

  const signOutUser = useCallback(async () => {
    setAccount(null);
    confirmationRef.current = null;
    pendingPhoneRef.current = null;
    verifierRef.current?.clear();
    verifierRef.current = null;
    await clearServerSession();
    if (auth) await signOut(auth);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,
      account,
      isAuthed: account != null,
      updateProfile,
      signInWithGoogle,
      importGoogleProfile,
      sendOtp,
      verifyOtp,
      signOutUser,
    }),
    [
      user,
      loading,
      account,
      updateProfile,
      signInWithGoogle,
      importGoogleProfile,
      sendOtp,
      verifyOtp,
      signOutUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>");
  return ctx;
}
