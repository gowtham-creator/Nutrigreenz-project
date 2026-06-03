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
  signOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type User,
  type ConfirmationResult,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";

const NOT_CONFIGURED =
  "Authentication isn't configured yet — add your Firebase keys to .env.local.";

const ACCOUNT_KEY = "ng.account.v1";

/**
 * A unified, persisted account that works in BOTH real-Firebase and demo modes.
 * Stored in localStorage under `ng.account.v1` so a session (and any profile
 * edits) survive reloads regardless of whether Firebase keys are present.
 */
export interface NgAccount {
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
    name: user.displayName ?? "",
    email: user.email ?? "",
    phone: user.phoneNumber ?? "",
    photoURL: user.photoURL ?? undefined,
    method: user.phoneNumber && !user.email ? "phone" : "google",
    memberSince: saved?.memberSince ?? new Date().toISOString(),
  };
  // Saved profile edits win over Firebase-derived fields.
  if (!saved) return base;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<NgAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Holds the live Firebase ConfirmationResult OR, in demo mode, the pending phone.
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const pendingPhoneRef = useRef<string | null>(null);

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
      } else {
        setAccount(null);
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
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
    // onAuthStateChanged populates `account`.
  }, []);

  const sendOtp = useCallback(
    async (phone: string, recaptchaContainerId = "recaptcha-container") => {
      if (!auth) {
        // DEMO: no network — just remember the phone we'll "verify".
        pendingPhoneRef.current = phone;
        return;
      }
      const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
        size: "invisible",
      });
      confirmationRef.current = await signInWithPhoneNumber(auth, phone, verifier);
    },
    [],
  );

  const verifyOtp = useCallback(async (code: string) => {
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
