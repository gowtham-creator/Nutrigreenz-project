"use client";

import * as React from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { Card, Pill } from "@/components/ng/admin/admin-shell";
import { SectionHeader, PrimarySection } from "@/components/ng/admin/super/command-center";
import { NumberField, Toggle, SegToggle, TextField, SaveBar } from "@/components/ng/admin/super/controls";

/**
 * Super Admin · Commerce Rules (Phase B — DB-backed).
 *
 * Edits the singleton `commerce_rules` config plus the `delivery_slots` and
 * `serviceable_areas` lists, all persisted through the super-admin-gated
 * `/api/admin/config/commerce/**` endpoints (Supabase service-role). Money is
 * stored in paise but shown/edited in rupees here. This panel is the canonical
 * source of truth; the storefront reads it via the public `/api/commerce-rules`.
 *
 * Distinct from the legacy localStorage `Global commerce rules` section — that
 * stays for the front-end demo store; this is the real backend control.
 */

/* ── client-side shapes (mirror the JSON the API returns) ─────────────── */

type ShippingType = "flat" | "slab" | "zero";
type TaxMode = "inclusive" | "exclusive";

interface ShippingSlab {
  uptoPaise: number;
  feePaise: number;
}

interface CommerceRules {
  minOrderPaise: number;
  freeDeliveryThresholdPaise: number;
  shippingType: ShippingType;
  shippingFlatPaise: number;
  shippingSlabs: ShippingSlab[];
  taxMode: TaxMode;
  taxRateBps: number;
  currency: string;
  updatedAt?: string | null;
}

interface DeliverySlot {
  id: string;
  label: string;
  windowText: string | null;
  sort: number;
  active: boolean;
}

interface ServiceableArea {
  id: string;
  pincode: string;
  area: string | null;
  community: string | null;
  active: boolean;
}

const DEFAULT_RULES: CommerceRules = {
  minOrderPaise: 30000,
  freeDeliveryThresholdPaise: 59900,
  shippingType: "flat",
  shippingFlatPaise: 4000,
  shippingSlabs: [],
  taxMode: "inclusive",
  taxRateBps: 0,
  currency: "INR",
};

/* ── money helpers ────────────────────────────────────────────────────── */

const rupees = (paise: number) => Math.round(paise) / 100;
const toPaise = (rupeeValue: number) => Math.max(0, Math.round(rupeeValue * 100));

/* ── fetch helpers ────────────────────────────────────────────────────── */

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) throw new Error(data.error || "request-failed");
  return data;
}

async function sendJson<T>(url: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) throw new Error(data.error || "request-failed");
  return data;
}

const API = "/api/admin/config/commerce";

export function CommerceConfigPanel() {
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [rules, setRules] = React.useState<CommerceRules>(DEFAULT_RULES);
  const [slots, setSlots] = React.useState<DeliverySlot[]>([]);
  const [areas, setAreas] = React.useState<ServiceableArea[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [r, s, a] = await Promise.all([
        getJson<{ rules: CommerceRules }>(API),
        getJson<{ slots: DeliverySlot[] }>(`${API}/slots`),
        getJson<{ areas: ServiceableArea[] }>(`${API}/areas`),
      ]);
      setRules({ ...DEFAULT_RULES, ...r.rules });
      setSlots(s.slots);
      setAreas(a.areas);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load commerce config.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <PrimarySection id="commerce">
      <div className="space-y-6">
        <RulesCard
          loading={loading}
          loadError={loadError}
          rules={rules}
          onSaved={(next) => setRules(next)}
          onRetry={load}
        />
        <SlotsCard slots={slots} loading={loading} setSlots={setSlots} />
        <AreasCard areas={areas} loading={loading} setAreas={setAreas} />
      </div>
    </PrimarySection>
  );
}

/* =======================================================================
 * Commerce rules (singleton) editor
 * ===================================================================== */
function RulesCard({
  loading,
  loadError,
  rules,
  onSaved,
  onRetry,
}: {
  loading: boolean;
  loadError: string | null;
  rules: CommerceRules;
  onSaved: (next: CommerceRules) => void;
  onRetry: () => void;
}) {
  const [draft, setDraft] = React.useState<CommerceRules>(rules);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => setDraft(rules), [rules]);

  const dirty = React.useMemo(() => JSON.stringify(draft) !== JSON.stringify(rules), [draft, rules]);

  function patch<K extends keyof CommerceRules>(key: K, val: CommerceRules[K]) {
    setDraft((d) => ({ ...d, [key]: val }));
  }

  function patchSlab(idx: number, p: Partial<ShippingSlab>) {
    setDraft((d) => ({
      ...d,
      shippingSlabs: d.shippingSlabs.map((s, i) => (i === idx ? { ...s, ...p } : s)),
    }));
  }
  function addSlab() {
    setDraft((d) => ({ ...d, shippingSlabs: [...d.shippingSlabs, { uptoPaise: 0, feePaise: 0 }] }));
  }
  function removeSlab(idx: number) {
    setDraft((d) => ({ ...d, shippingSlabs: d.shippingSlabs.filter((_, i) => i !== idx) }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await sendJson<{ rules: CommerceRules }>(API, "PUT", {
        minOrderPaise: draft.minOrderPaise,
        freeDeliveryThresholdPaise: draft.freeDeliveryThresholdPaise,
        shippingType: draft.shippingType,
        shippingFlatPaise: draft.shippingFlatPaise,
        shippingSlabs: draft.shippingSlabs,
        taxMode: draft.taxMode,
        taxRateBps: draft.taxRateBps,
        currency: draft.currency,
      });
      onSaved({ ...DEFAULT_RULES, ...res.rules });
      toast.success("Commerce rules saved", {
        description: "Applied to the live storefront via the public commerce-rules feed.",
      });
    } catch (err) {
      toast.error("Could not save commerce rules", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDraft(rules);
    toast.info("Reverted unsaved changes");
  }

  return (
    <Card>
      <SectionHeader
        icon="settings"
        tone="forest"
        title="Commerce rules"
        caption="Order minimum, free-delivery threshold, shipping model & tax. The live storefront economics."
        badge={
          loading ? (
            <span className="ng-eyebrow text-ng-ink-soft">Loading…</span>
          ) : dirty ? (
            <Pill tone="warn">Unsaved</Pill>
          ) : (
            <Pill tone="success">Synced</Pill>
          )
        }
      />

      {loadError ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-ng-terracotta/30 bg-ng-terracotta/5 px-4 py-3">
          <span className="text-[12.5px] font-medium text-ng-terracotta">{loadError}</span>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-ng-line text-ng-ink font-semibold px-3.5 py-1.5 text-[12px] hover:bg-ng-cream transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <NumberField
              label="Minimum order value"
              value={rupees(draft.minOrderPaise)}
              onChange={(v) => patch("minOrderPaise", toPaise(v))}
              prefix="₹"
              step={10}
              hint="Cart must reach this to checkout"
            />
            <NumberField
              label="Free-delivery threshold"
              value={rupees(draft.freeDeliveryThresholdPaise)}
              onChange={(v) => patch("freeDeliveryThresholdPaise", toPaise(v))}
              prefix="₹"
              step={10}
              hint="Free at/above this subtotal"
            />
            <NumberField
              label="Flat delivery fee"
              value={rupees(draft.shippingFlatPaise)}
              onChange={(v) => patch("shippingFlatPaise", toPaise(v))}
              prefix="₹"
              step={5}
              hint={draft.shippingType === "flat" ? "Charged below the threshold" : "Used when shipping is flat"}
            />
            <SegToggle
              label="Tax display mode"
              value={draft.taxMode}
              onChange={(v) => patch("taxMode", v)}
              options={[
                { value: "inclusive", label: "Inclusive" },
                { value: "exclusive", label: "Exclusive" },
              ]}
              hint={draft.taxMode === "inclusive" ? "Shown prices include tax" : "Tax added at checkout"}
            />
            <NumberField
              label="Tax rate"
              value={draft.taxRateBps / 100}
              onChange={(v) => patch("taxRateBps", Math.max(0, Math.round(v * 100)))}
              suffix="%"
              step={0.5}
              hint="GST applied when mode is exclusive"
            />
            <TextField
              label="Currency"
              value={draft.currency}
              onChange={(v) => patch("currency", v.toUpperCase())}
              placeholder="INR"
            />
          </div>

          {/* Shipping model */}
          <div className="mt-6 pt-5 border-t border-ng-line-soft">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <SegToggle
                label="Shipping model"
                value={draft.shippingType}
                onChange={(v) => patch("shippingType", v as ShippingType)}
                options={[
                  { value: "flat", label: "Flat" },
                  { value: "slab", label: "Slab" },
                  { value: "zero", label: "Free" },
                ]}
                hint={
                  draft.shippingType === "zero"
                    ? "Delivery is free for every order"
                    : draft.shippingType === "slab"
                      ? "Tiered fee by cart subtotal"
                      : "Single flat fee below the free threshold"
                }
              />
            </div>

            {draft.shippingType === "slab" ? (
              <div className="mt-2">
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <span className="text-[12.5px] font-semibold text-ng-ink">Shipping slabs</span>
                  <button
                    type="button"
                    onClick={addSlab}
                    className="inline-flex items-center gap-1 text-[12px] text-ng-forest font-semibold hover:text-ng-leaf transition-colors cursor-pointer"
                  >
                    <Icon name="add-circle-bold" size={15} />
                    Add slab
                  </button>
                </div>
                <ul className="space-y-2.5">
                  {draft.shippingSlabs.map((slab, idx) => (
                    <li
                      key={idx}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-end rounded-xl border border-ng-line-soft bg-ng-cream/40 p-3"
                    >
                      <NumberField
                        label="Cart up to"
                        value={rupees(slab.uptoPaise)}
                        onChange={(v) => patchSlab(idx, { uptoPaise: toPaise(v) })}
                        prefix="₹"
                        step={50}
                      />
                      <NumberField
                        label="Delivery fee"
                        value={rupees(slab.feePaise)}
                        onChange={(v) => patchSlab(idx, { feePaise: toPaise(v) })}
                        prefix="₹"
                        step={5}
                      />
                      <button
                        type="button"
                        onClick={() => removeSlab(idx)}
                        aria-label={`Remove slab ${idx + 1}`}
                        className="h-11 px-3 rounded-xl border border-ng-line text-ng-terracotta hover:bg-ng-terracotta/10 transition-colors cursor-pointer"
                      >
                        <Icon name="trash-bin-trash-bold" size={16} />
                      </button>
                    </li>
                  ))}
                  {draft.shippingSlabs.length === 0 ? (
                    <li className="text-[12px] font-medium text-ng-ink-soft py-1">
                      No slabs yet, add one above.
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>

          <SaveBar
            note={
              saving
                ? "Saving…"
                : "Persisted to Supabase. The storefront reads it from /api/commerce-rules."
            }
            onSave={save}
            onReset={reset}
            dirty={dirty}
          />
        </>
      )}
    </Card>
  );
}

/* =======================================================================
 * Delivery slots manager
 * ===================================================================== */
function SlotsCard({
  slots,
  loading,
  setSlots,
}: {
  slots: DeliverySlot[];
  loading: boolean;
  setSlots: React.Dispatch<React.SetStateAction<DeliverySlot[]>>;
}) {
  const [busy, setBusy] = React.useState(false);

  function patchLocal(id: string, p: Partial<DeliverySlot>) {
    setSlots((list) => list.map((s) => (s.id === id ? { ...s, ...p } : s)));
  }

  async function addSlot() {
    setBusy(true);
    try {
      const res = await sendJson<{ slot: DeliverySlot }>(`${API}/slots`, "POST", {
        label: "New slot",
        windowText: "",
        sort: slots.length,
        active: true,
      });
      setSlots((list) => [...list, res.slot]);
      toast.success("Slot added");
    } catch (err) {
      toast.error("Could not add slot", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function saveSlot(slot: DeliverySlot) {
    setBusy(true);
    try {
      await sendJson(`${API}/slots/${slot.id}`, "PATCH", {
        label: slot.label,
        windowText: slot.windowText ?? "",
        sort: slot.sort,
        active: slot.active,
      });
      toast.success("Slot saved");
    } catch (err) {
      toast.error("Could not save slot", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function removeSlot(id: string) {
    setBusy(true);
    try {
      await sendJson(`${API}/slots/${id}`, "DELETE", {});
      setSlots((list) => list.filter((s) => s.id !== id));
      toast.success("Slot removed");
    } catch (err) {
      toast.error("Could not remove slot", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionHeader
        icon="clock-circle-bold"
        tone="clay"
        title="Delivery slots"
        caption="The delivery windows shoppers pick at checkout. Toggle off to hide a slot without deleting it."
        action={
          <button
            type="button"
            onClick={addSlot}
            disabled={busy || loading}
            className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-3.5 py-1.5 text-[12px] hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50"
          >
            <Icon name="add-circle-bold" size={14} />
            Add slot
          </button>
        }
        badge={
          <span className="text-[11px] uppercase tracking-wider font-semibold text-ng-ink-muted">
            {slots.filter((s) => s.active).length} / {slots.length} active
          </span>
        }
      />

      {loading ? (
        <p className="text-[12.5px] font-medium text-ng-ink-soft py-2">Loading slots…</p>
      ) : (
        <ul className="space-y-2.5">
          {slots.map((slot) => (
            <li
              key={slot.id}
              className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,0.7fr)_auto_auto] gap-3 items-end rounded-xl border border-ng-line-soft bg-ng-cream/40 p-3"
            >
              <TextField
                label="Label"
                value={slot.label}
                onChange={(v) => patchLocal(slot.id, { label: v })}
                placeholder="Morning"
              />
              <TextField
                label="Window"
                value={slot.windowText ?? ""}
                onChange={(v) => patchLocal(slot.id, { windowText: v })}
                placeholder="7:00 AM – 10:00 AM"
              />
              <NumberField
                label="Sort"
                value={slot.sort}
                onChange={(v) => patchLocal(slot.id, { sort: v })}
                step={1}
              />
              <div className="rounded-xl border border-ng-line-soft bg-ng-paper px-3">
                <Toggle
                  label="Active"
                  checked={slot.active}
                  onChange={(on) => patchLocal(slot.id, { active: on })}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => saveSlot(slot)}
                  disabled={busy}
                  aria-label={`Save slot ${slot.label}`}
                  className="h-11 px-3.5 rounded-xl bg-ng-forest-deep text-ng-cream hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Icon name="save" size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => removeSlot(slot.id)}
                  disabled={busy}
                  aria-label={`Remove slot ${slot.label}`}
                  className="h-11 px-3 rounded-xl border border-ng-line text-ng-terracotta hover:bg-ng-terracotta/10 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Icon name="trash-bin-trash-bold" size={16} />
                </button>
              </div>
            </li>
          ))}
          {slots.length === 0 ? (
            <li className="text-[12px] font-medium text-ng-ink-soft py-2">
              No delivery slots, add one above.
            </li>
          ) : null}
        </ul>
      )}
    </Card>
  );
}

/* =======================================================================
 * Serviceable areas manager (+ CSV import)
 * ===================================================================== */
function AreasCard({
  areas,
  loading,
  setAreas,
}: {
  areas: ServiceableArea[];
  loading: boolean;
  setAreas: React.Dispatch<React.SetStateAction<ServiceableArea[]>>;
}) {
  const [busy, setBusy] = React.useState(false);
  const [newPin, setNewPin] = React.useState("");
  const [newArea, setNewArea] = React.useState("");
  const [newCommunity, setNewCommunity] = React.useState("");
  const [csv, setCsv] = React.useState("");
  const [showImport, setShowImport] = React.useState(false);

  function patchLocal(id: string, p: Partial<ServiceableArea>) {
    setAreas((list) => list.map((a) => (a.id === id ? { ...a, ...p } : a)));
  }

  async function addArea() {
    const pincode = newPin.trim();
    if (!pincode) {
      toast.error("Enter a pincode first");
      return;
    }
    setBusy(true);
    try {
      const res = await sendJson<{ area: ServiceableArea }>(`${API}/areas`, "POST", {
        pincode,
        area: newArea.trim() || undefined,
        community: newCommunity.trim() || undefined,
      });
      setAreas((list) => [...list, res.area].sort((a, b) => a.pincode.localeCompare(b.pincode)));
      setNewPin("");
      setNewArea("");
      setNewCommunity("");
      toast.success("Area added");
    } catch (err) {
      toast.error("Could not add area", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function saveArea(area: ServiceableArea) {
    setBusy(true);
    try {
      await sendJson(`${API}/areas/${area.id}`, "PATCH", {
        pincode: area.pincode,
        area: area.area ?? "",
        community: area.community ?? "",
        active: area.active,
      });
      toast.success("Area saved");
    } catch (err) {
      toast.error("Could not save area", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function removeArea(id: string) {
    setBusy(true);
    try {
      await sendJson(`${API}/areas/${id}`, "DELETE", {});
      setAreas((list) => list.filter((a) => a.id !== id));
      toast.success("Area removed");
    } catch (err) {
      toast.error("Could not remove area", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function importCsv() {
    if (!csv.trim()) {
      toast.error("Paste some pincodes first");
      return;
    }
    setBusy(true);
    try {
      const res = await sendJson<{ created: number; skipped: number; errors: string[] }>(
        `${API}/areas`,
        "POST",
        { csv },
      );
      toast.success(`Imported ${res.created} pincode${res.created === 1 ? "" : "s"}`, {
        description: res.skipped ? `${res.skipped} skipped (blank or already present).` : undefined,
      });
      setCsv("");
      setShowImport(false);
      // Re-fetch to reflect the imported rows.
      const fresh = await getJson<{ areas: ServiceableArea[] }>(`${API}/areas`);
      setAreas(fresh.areas);
    } catch (err) {
      toast.error("Import failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionHeader
        icon="map-point-wave-bold"
        tone="forest"
        title="Serviceable areas"
        caption="Pincodes you deliver to. When the list is empty, every pincode is treated as serviceable."
        action={
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-semibold px-3.5 py-1.5 text-[12px] hover:bg-ng-cream transition-colors cursor-pointer"
          >
            <UiIcon name="import" size={14} />
            Import CSV
          </button>
        }
        badge={
          <span className="text-[11px] uppercase tracking-wider font-semibold text-ng-ink-muted">
            {areas.filter((a) => a.active).length} / {areas.length} live
          </span>
        }
      />

      {/* CSV import drawer */}
      {showImport ? (
        <div className="mb-5 rounded-xl border border-ng-line-soft bg-ng-cream/50 p-4">
          <label className="block text-[12.5px] font-semibold text-ng-ink-muted mb-1.5">
            Paste CSV: columns: pincode, area, community (header optional)
          </label>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={5}
            placeholder={"pincode,area,community\n500081,Madhapur,Hitech City\n500084,Gachibowli,"}
            className="w-full rounded-xl bg-ng-paper border border-ng-line outline-none text-[13px] font-mono text-ng-ink p-3 placeholder:text-ng-ink-soft focus:border-ng-forest focus:shadow-[0_0_0_3px_rgba(184,212,154,0.30)] transition-all"
          />
          <div className="mt-3 flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setShowImport(false);
                setCsv("");
              }}
              className="rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-cream transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={importCsv}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50"
            >
              <Icon name="upload-bold" size={14} />
              Import pincodes
            </button>
          </div>
        </div>
      ) : null}

      {/* Add a single area */}
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-end rounded-xl border border-dashed border-ng-line bg-ng-paper/60 p-3 mb-4">
        <TextField label="Pincode" value={newPin} onChange={setNewPin} placeholder="500081" />
        <TextField label="Area" value={newArea} onChange={setNewArea} placeholder="Madhapur" />
        <TextField
          label="Community"
          value={newCommunity}
          onChange={setNewCommunity}
          placeholder="Hitech City"
        />
        <button
          type="button"
          onClick={addArea}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-ng-forest-deep text-ng-cream font-semibold px-4 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50"
        >
          <Icon name="add-circle-bold" size={15} />
          Add
        </button>
      </div>

      {loading ? (
        <p className="text-[12.5px] font-medium text-ng-ink-soft py-2">Loading areas…</p>
      ) : areas.length === 0 ? (
        <p className="text-[12.5px] font-medium text-ng-ink-soft py-2">
          No serviceable areas configured. Every pincode is currently treated as deliverable.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {areas.map((area) => (
            <li
              key={area.id}
              className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_auto_auto] gap-3 items-end rounded-xl border border-ng-line-soft bg-ng-cream/40 p-3"
            >
              <TextField
                label="Pincode"
                value={area.pincode}
                onChange={(v) => patchLocal(area.id, { pincode: v })}
              />
              <TextField
                label="Area"
                value={area.area ?? ""}
                onChange={(v) => patchLocal(area.id, { area: v })}
                placeholder="—"
              />
              <TextField
                label="Community"
                value={area.community ?? ""}
                onChange={(v) => patchLocal(area.id, { community: v })}
                placeholder="—"
              />
              <div className="rounded-xl border border-ng-line-soft bg-ng-paper px-3">
                <Toggle
                  label="Live"
                  checked={area.active}
                  onChange={(on) => patchLocal(area.id, { active: on })}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => saveArea(area)}
                  disabled={busy}
                  aria-label={`Save area ${area.pincode}`}
                  className="h-11 px-3.5 rounded-xl bg-ng-forest-deep text-ng-cream hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Icon name="save" size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => removeArea(area.id)}
                  disabled={busy}
                  aria-label={`Remove area ${area.pincode}`}
                  className="h-11 px-3 rounded-xl border border-ng-line text-ng-terracotta hover:bg-ng-terracotta/10 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Icon name="trash-bin-trash-bold" size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
