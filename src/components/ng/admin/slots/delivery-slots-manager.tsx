"use client";

import * as React from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Card, Pill } from "@/components/ng/admin/admin-shell";
import { SectionHeader } from "@/components/ng/admin/super/command-center";
import { NumberField, TextField, Toggle } from "@/components/ng/admin/super/controls";
import { invalidateAdminGet } from "@/lib/admin-get";
import { cn } from "@/lib/utils";

/**
 * Delivery slots: the windows a customer can pick at checkout.
 *
 * Shared by the Orders portal and Super Admin config, so both show the same
 * truth. What each row says is the SAVED state: the old editor flipped its
 * Active switch locally and only wrote it when the unlabelled save icon beside
 * it was pressed, so a slot could look off here while customers still booked
 * it. Now the switch saves on the spot, name and window edits say they are
 * unsaved until saved, and a new slot is only created when its form is saved
 * (it used to go live at checkout as "New slot" the moment Add was pressed).
 *
 * Writes go through the super-admin config API; `canEdit` only decides what
 * this screen offers, the API decides what is allowed.
 */

export interface ManagedSlot {
  id: string;
  label: string;
  windowText: string | null;
  sort: number;
  active: boolean;
  /** Orders placed today that chose this slot, when the caller knows it. */
  todayOrders?: number;
}

const API = "/api/admin/config/commerce/slots";
const LABEL_MAX = 40;
const WINDOW_MAX = 40;

function errorText(err: unknown): string | undefined {
  const code = err instanceof Error ? err.message : "";
  if (code === "superadmin-required") return "Only a super admin can change delivery slots.";
  if (code === "invalid") return "Give the slot a name.";
  if (code === "not-found") return "That slot no longer exists. Refresh the page.";
  return code && code !== "request-failed" ? code : undefined;
}

async function send<T>(url: string, method: string, body: unknown): Promise<T> {
  // The config page reads slots through the shared loader; drop its copy.
  invalidateAdminGet("/api/admin/config/");
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) throw new Error(data.error || "request-failed");
  return data;
}

type Draft = { label: string; windowText: string; sort: number };

const toDraft = (s: ManagedSlot): Draft => ({ label: s.label, windowText: s.windowText ?? "", sort: s.sort });

const sameDraft = (a: Draft, b: Draft) =>
  a.label.trim() === b.label.trim() && a.windowText.trim() === b.windowText.trim() && a.sort === b.sort;

export function DeliverySlotsManager({
  slots,
  onSlotsChange,
  canEdit,
  loading = false,
  showTodayCounts = false,
  className,
}: {
  /** The saved slots. The caller owns the list; every write reports back. */
  slots: ManagedSlot[];
  onSlotsChange: (update: (list: ManagedSlot[]) => ManagedSlot[]) => void;
  canEdit: boolean;
  loading?: boolean;
  showTodayCounts?: boolean;
  className?: string;
}) {
  // Unsaved name/window/order edits, by slot id. Kept apart from the saved list
  // so a background refresh of `slots` never wipes what someone is typing.
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState<{ label: string; windowText: string; active: boolean } | null>(null);

  const dropDraft = (id: string) =>
    setDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });

  const sorted = React.useMemo(
    () => [...slots].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label)),
    [slots],
  );
  const activeCount = slots.filter((s) => s.active).length;

  function replace(saved: ManagedSlot) {
    onSlotsChange((list) =>
      list.map((s) => (s.id === saved.id ? { ...saved, todayOrders: s.todayOrders } : s)),
    );
  }

  async function setActive(slot: ManagedSlot, active: boolean) {
    setBusy(slot.id);
    replace({ ...slot, active }); // shown at once, put back if the save fails
    try {
      const res = await send<{ slot: ManagedSlot }>(`${API}/${slot.id}`, "PATCH", { active });
      replace(res.slot);
      toast.success(active ? `${slot.label} is open for orders` : `${slot.label} is closed`, {
        description: active ? "Customers can pick it at checkout." : "Customers can no longer pick it at checkout.",
      });
    } catch (err) {
      replace(slot);
      toast.error("Couldn't change the slot", { description: errorText(err) });
    } finally {
      setBusy(null);
    }
  }

  async function saveEdits(slot: ManagedSlot) {
    const draft = drafts[slot.id];
    if (!draft) return;
    if (!draft.label.trim()) {
      toast.error("Give the slot a name.");
      return;
    }
    setBusy(slot.id);
    try {
      const res = await send<{ slot: ManagedSlot }>(`${API}/${slot.id}`, "PATCH", {
        label: draft.label.trim(),
        windowText: draft.windowText.trim(),
        sort: draft.sort,
      });
      replace(res.slot);
      dropDraft(slot.id);
      toast.success("Slot saved");
    } catch (err) {
      toast.error("Couldn't save the slot", { description: errorText(err) });
    } finally {
      setBusy(null);
    }
  }

  async function remove(slot: ManagedSlot) {
    setBusy(slot.id);
    try {
      await send(`${API}/${slot.id}`, "DELETE", {});
      onSlotsChange((list) => list.filter((s) => s.id !== slot.id));
      dropDraft(slot.id);
      toast.success(`${slot.label} removed`);
    } catch (err) {
      toast.error("Couldn't remove the slot", { description: errorText(err) });
    } finally {
      setBusy(null);
      setConfirmRemove(null);
    }
  }

  async function create() {
    if (!adding) return;
    const label = adding.label.trim();
    if (!label) {
      toast.error("Give the slot a name.");
      return;
    }
    setBusy("new");
    try {
      const res = await send<{ slot: ManagedSlot }>(API, "POST", {
        label,
        windowText: adding.windowText.trim(),
        sort: slots.reduce((max, s) => Math.max(max, s.sort), -1) + 1,
        active: adding.active,
      });
      onSlotsChange((list) => [...list, { ...res.slot, todayOrders: 0 }]);
      setAdding(null);
      toast.success(`${label} saved`, {
        description: adding.active ? "Customers can pick it at checkout now." : "It stays closed until you open it.",
      });
    } catch (err) {
      toast.error("Couldn't save the slot", { description: errorText(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className={className}>
      <SectionHeader
        icon="clock-circle-bold"
        tone="clay"
        title="Delivery slots"
        caption={
          canEdit
            ? "The windows customers can pick at checkout. Closing a slot hides it at once; it is not deleted."
            : "The windows customers can pick at checkout. Only a super admin can change them."
        }
        action={
          canEdit && !adding ? (
            <button
              type="button"
              onClick={() => setAdding({ label: "", windowText: "", active: true })}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-3.5 py-1.5 text-[12px] hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50"
            >
              <Icon name="add-circle-bold" size={14} />
              Add slot
            </button>
          ) : null
        }
        badge={
          <span className="text-[11px] uppercase tracking-wider font-semibold text-ng-ink-muted whitespace-nowrap">
            {activeCount} / {slots.length} open
          </span>
        }
      />

      {!loading && slots.length > 0 && activeCount === 0 ? (
        <p
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-xl bg-[#FBE0DB] px-3.5 py-3 text-[12.5px] font-semibold text-[#9B2C15] ng-dark:bg-[#3A1810] ng-dark:text-[#F0A48D]"
        >
          <Icon name="danger-triangle-bold" size={16} className="mt-px" />
          Every slot is closed, so customers cannot place orders. Open at least one slot.
        </p>
      ) : null}

      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
          className="mb-4 rounded-xl border border-ng-forest/30 bg-ng-sage/15 p-3.5"
          aria-label="New delivery slot"
        >
          <div className="mb-2.5 text-[12px] font-bold uppercase tracking-wider text-ng-forest-deep">New slot</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <TextField
              label="Name"
              value={adding.label}
              onChange={(v) => setAdding((a) => (a ? { ...a, label: v.slice(0, LABEL_MAX) } : a))}
              placeholder="Morning"
            />
            <TextField
              label="Time window"
              value={adding.windowText}
              onChange={(v) => setAdding((a) => (a ? { ...a, windowText: v.slice(0, WINDOW_MAX) } : a))}
              placeholder="7:00 AM – 10:00 AM"
            />
            <div className="rounded-xl border border-ng-line-soft bg-ng-paper px-3">
              <Toggle
                label="Open for orders"
                checked={adding.active}
                onChange={(on) => setAdding((a) => (a ? { ...a, active: on } : a))}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdding(null)}
              disabled={busy === "new"}
              className="h-10 rounded-xl border border-ng-line px-4 text-[13px] font-semibold text-ng-ink hover:bg-ng-paper transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy === "new" || !adding.label.trim()}
              className="h-10 rounded-xl bg-ng-forest-deep px-4 text-[13px] font-semibold text-ng-cream hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50"
            >
              {busy === "new" ? "Saving…" : "Save slot"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="text-[12.5px] font-medium text-ng-ink-soft py-2">Loading slots…</p>
      ) : (
        <ul className="space-y-2.5">
          {sorted.map((slot) => {
            const draft = drafts[slot.id] ?? toDraft(slot);
            const dirty = !sameDraft(draft, toDraft(slot));
            const rowBusy = busy === slot.id;
            const setDraft = (patch: Partial<Draft>) =>
              setDrafts((d) => ({ ...d, [slot.id]: { ...(d[slot.id] ?? toDraft(slot)), ...patch } }));
            return (
              <li
                key={slot.id}
                className={cn(
                  "rounded-xl border p-3",
                  slot.active ? "border-ng-line-soft bg-ng-cream/40" : "border-dashed border-ng-line bg-ng-paper",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[14px] text-ng-ink">{slot.label}</span>
                  {slot.windowText ? (
                    <span className="text-[12.5px] font-medium text-ng-ink-muted">{slot.windowText}</span>
                  ) : null}
                  <Pill tone={slot.active ? "success" : "neutral"}>{slot.active ? "Open" : "Closed"}</Pill>
                  {dirty ? <Pill tone="warn">Unsaved</Pill> : null}
                  {showTodayCounts ? (
                    <span className="ml-auto text-[12px] font-medium text-ng-ink-muted tabular-nums">
                      {slot.todayOrders ?? 0} order{slot.todayOrders === 1 ? "" : "s"} today
                    </span>
                  ) : null}
                </div>

                {canEdit ? (
                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,0.6fr)_auto_auto] lg:items-end">
                    <TextField
                      label="Name"
                      value={draft.label}
                      onChange={(v) => setDraft({ label: v.slice(0, LABEL_MAX) })}
                      placeholder="Morning"
                    />
                    <TextField
                      label="Time window"
                      value={draft.windowText}
                      onChange={(v) => setDraft({ windowText: v.slice(0, WINDOW_MAX) })}
                      placeholder="7:00 AM – 10:00 AM"
                    />
                    <NumberField label="Order" value={draft.sort} onChange={(v) => setDraft({ sort: v })} step={1} />
                    <div className="rounded-xl border border-ng-line-soft bg-ng-paper px-3">
                      <Toggle
                        label="Open for orders"
                        checked={slot.active}
                        onChange={(on) => {
                          if (!rowBusy) void setActive(slot, on);
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {confirmRemove === slot.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void remove(slot)}
                            disabled={rowBusy}
                            className="h-11 rounded-xl bg-ng-terracotta px-3.5 text-[12.5px] font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemove(null)}
                            className="h-11 rounded-xl border border-ng-line px-3.5 text-[12.5px] font-semibold text-ng-ink hover:bg-ng-cream transition-colors cursor-pointer"
                          >
                            Keep
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => void saveEdits(slot)}
                            disabled={!dirty || rowBusy}
                            className="h-11 rounded-xl bg-ng-forest-deep px-3.5 text-[12.5px] font-semibold text-ng-cream hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-40"
                          >
                            {rowBusy && dirty ? "Saving…" : "Save"}
                          </button>
                          {dirty ? (
                            <button
                              type="button"
                              onClick={() => dropDraft(slot.id)}
                              className="h-11 rounded-xl border border-ng-line px-3 text-[12.5px] font-semibold text-ng-ink hover:bg-ng-cream transition-colors cursor-pointer"
                            >
                              Undo
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRemove(slot.id)}
                              disabled={rowBusy}
                              aria-label={`Remove slot ${slot.label}`}
                              className="h-11 rounded-xl border border-ng-line px-3 text-ng-terracotta hover:bg-ng-terracotta/10 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Icon name="trash-bin-trash-bold" size={16} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
          {slots.length === 0 ? (
            <li className="text-[12.5px] font-medium text-ng-ink-soft py-2">
              {canEdit
                ? "No delivery slots yet, so customers cannot place orders. Add one above."
                : "No delivery slots yet, so customers cannot place orders."}
            </li>
          ) : null}
        </ul>
      )}
    </Card>
  );
}
