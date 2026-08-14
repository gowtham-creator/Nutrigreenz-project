"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import type { Captain } from "@/types/nutrigreenz";
import { CommunityPicker } from "@/components/ng/admin/community-picker";

/**
 * Admin · Captains — create / edit modal.
 *
 * Mirrors the inventory product-modal so the roster editor feels identical to
 * the rest of the admin portal. Money never enters here (commission is a whole
 * percent); the parent converts + calls the API, and passes back any 400/409
 * error CODE via `error` so we can surface it inline against the right field.
 */

export interface CaptainDraft {
  name: string;
  phone: string;
  area: string;
  stall: string;
  communities: string[];
  /** Whole-number percent as free text; the page coerces to a number. */
  commissionPercent: string;
  active: boolean;
}

// Communities are searched live through Google Places (see CommunityPicker)
// rather than chosen from a fixed list. The previous hardcoded set covered only
// a dozen Hyderabad societies, which cannot serve a national catalogue.

/** Human-readable copy for each API error code, keyed by the field it belongs to. */
const ERROR_COPY: Record<string, string> = {
  name_required: "Enter the captain's name.",
  invalid_phone: "Enter a valid 10-digit mobile number.",
  invalid_commission: "Commission must be a whole number from 0 to 100.",
  phone_taken: "That mobile already belongs to another captain.",
};

/** Which field an API error code should be shown against. */
function errorField(code: string | null): "name" | "phone" | "commission" | null {
  if (code === "name_required") return "name";
  if (code === "invalid_phone" || code === "phone_taken") return "phone";
  if (code === "invalid_commission") return "commission";
  return null;
}

function draftFromCaptain(c: Captain | null): CaptainDraft {
  return {
    name: c?.name ?? "",
    phone: c?.phone ?? "",
    area: c?.area ?? "",
    stall: c?.stall ?? "",
    communities: c?.communities ?? [],
    commissionPercent: c ? String(c.commissionPercent) : "",
    active: c?.active ?? true,
  };
}

const FIELD =
  "w-full rounded-xl bg-ng-paper border border-ng-line-soft px-3.5 py-2.5 text-[13px] text-ng-ink outline-none focus:border-ng-forest transition-colors";
const FIELD_ERR = "border-ng-danger focus:border-ng-danger";
const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted mb-1.5";

/** Small accessible on/off switch, reused by the roster table's Active column. */
export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ng-leaf focus-visible:ring-offset-2 focus-visible:ring-offset-ng-paper",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        checked ? "bg-ng-forest" : "bg-ng-line",
      )}
    >
      <span
        className={cn(
          "inline-block size-[18px] rounded-full bg-ng-white shadow-sm transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

export function CaptainModal({
  open,
  captain,
  saving,
  error,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  captain: Captain | null;
  saving: boolean;
  /** API error CODE from the last submit (e.g. "phone_taken"), or null. */
  error: string | null;
  onClose: () => void;
  onSave: (draft: CaptainDraft) => void;
  onDelete?: (captain: Captain) => void;
}) {
  const [draft, setDraft] = useState<CaptainDraft>(() => draftFromCaptain(captain));
  const [touched, setTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset the form whenever the modal opens (or the target captain changes) so a
  // reused instance never shows a previous captain's values.
  useEffect(() => {
    if (open) {
      setDraft(draftFromCaptain(captain));
      setTouched(false);
      setConfirmDelete(false);
    }
  }, [open, captain]);

  // Escape-to-close for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);


  if (!open) return null;

  const set = <K extends keyof CaptainDraft>(key: K, value: CaptainDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const phoneDigits = draft.phone.replace(/\D/g, "");
  const validPhone = phoneDigits.length === 10;
  const commissionRaw = draft.commissionPercent.trim();
  const commissionNum = commissionRaw === "" ? 0 : Number(commissionRaw);
  const validCommission =
    Number.isFinite(commissionNum) && commissionNum >= 0 && commissionNum <= 100;
  const validName = draft.name.trim().length > 0;
  const canSave = validName && validPhone && validCommission && !saving;

  const serverField = errorField(error);
  const serverMessage = error ? ERROR_COPY[error] ?? "Something went wrong. Please try again." : null;


  function submit() {
    setTouched(true);
    if (!canSave) return;
    onSave(draft);
  }

  // Field-level hint: prefer the server error (it out-ranks a passing local
  // check, e.g. phone_taken on a well-formed number), else the touched local rule.
  const nameHint =
    serverField === "name" ? serverMessage : touched && !validName ? ERROR_COPY.name_required : null;
  const phoneHint =
    serverField === "phone"
      ? serverMessage
      : touched && !validPhone
        ? ERROR_COPY.invalid_phone
        : null;
  const commissionHint =
    serverField === "commission"
      ? serverMessage
      : touched && !validCommission
        ? ERROR_COPY.invalid_commission
        : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ng-forest-deep/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={captain ? "Edit captain" : "Add captain"}
    >
      <div className="w-full max-w-lg rounded-2xl bg-ng-paper border border-ng-line-soft shadow-[var(--shadow-ng-modal)] max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 border-b border-ng-line-soft">
          <h2 className="font-display text-[19px] text-ng-forest-deep">
            {captain ? "Edit captain" : "Add captain"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ng-ink-muted hover:text-ng-ink transition-colors cursor-pointer"
          >
            <Icon name="close-circle-bold" size={20} />
          </button>
        </header>

        <div className="px-6 py-5 grid gap-4">
          {serverMessage && !serverField ? (
            <div className="rounded-xl border border-ng-danger/40 bg-ng-danger/10 px-3.5 py-2.5 text-[12.5px] font-semibold text-ng-danger">
              {serverMessage}
            </div>
          ) : null}

          <div>
            <label className={LABEL} htmlFor="nc-name">Name</label>
            <input
              id="nc-name"
              className={cn(FIELD, nameHint && FIELD_ERR)}
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Sneha Kumar"
            />
            {nameHint ? <p className="mt-1 text-[10.5px] font-semibold text-ng-danger">{nameHint}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL} htmlFor="nc-phone">Mobile (10-digit)</label>
              <input
                id="nc-phone"
                inputMode="numeric"
                maxLength={10}
                className={cn(FIELD, "font-mono tabular-nums", phoneHint && FIELD_ERR)}
                value={draft.phone}
                onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="9876543210"
              />
              {phoneHint ? <p className="mt-1 text-[10.5px] font-semibold text-ng-danger">{phoneHint}</p> : null}
            </div>
            <div>
              <label className={LABEL} htmlFor="nc-commission">Commission (%)</label>
              <input
                id="nc-commission"
                type="number"
                min={0}
                max={100}
                step={1}
                className={cn(FIELD, commissionHint && FIELD_ERR)}
                value={draft.commissionPercent}
                onChange={(e) => set("commissionPercent", e.target.value)}
                placeholder="4"
              />
              {commissionHint ? (
                <p className="mt-1 text-[10.5px] font-semibold text-ng-danger">{commissionHint}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL} htmlFor="nc-area">Area</label>
              <input
                id="nc-area"
                className={FIELD}
                value={draft.area}
                onChange={(e) => set("area", e.target.value)}
                placeholder="Madhapur"
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="nc-stall">Stall</label>
              <input
                id="nc-stall"
                className={FIELD}
                value={draft.stall}
                onChange={(e) => set("stall", e.target.value)}
                placeholder="Tower B lobby"
              />
            </div>
          </div>

          <CommunityPicker
            value={draft.communities}
            onChange={(next) => set("communities", next)}
            hint={
              draft.communities.length > 0
                ? `${draft.communities.length} assigned. Search to add another, anywhere in India.`
                : "Search and assign the communities this captain runs stalls in, anywhere in India."
            }
          />

          <div className="flex items-center justify-between gap-4 rounded-xl border border-ng-line-soft bg-ng-white px-3.5 py-3">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ng-ink">Active</div>
              <div className="text-[11.5px] font-medium text-ng-ink-muted">
                Inactive captains can no longer sign in to the field tool.
              </div>
            </div>
            <Switch
              checked={draft.active}
              onChange={(next) => set("active", next)}
              label="Captain is active"
            />
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 px-6 py-4 border-t border-ng-line-soft">
          <div>
            {captain && onDelete ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] font-semibold text-ng-ink-muted">Delete?</span>
                  <button
                    type="button"
                    onClick={() => onDelete(captain)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-ng-danger text-ng-cream font-semibold px-3 py-1.5 text-[12px] hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    <Icon name="trash-bin-trash-bold" size={14} />
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-[12px] font-semibold text-ng-ink-muted hover:text-ng-ink transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-terracotta font-medium px-3 py-2 text-[12.5px] hover:bg-ng-terracotta/10 transition-colors cursor-pointer"
                >
                  <Icon name="trash-bin-trash-bold" size={14} />
                  Delete
                </button>
              )
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={submit}
              className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="diskette-bold" size={15} />
              {saving ? "Saving…" : captain ? "Save changes" : "Create captain"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
