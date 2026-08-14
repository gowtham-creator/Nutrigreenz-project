"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ng/button";
import { Input } from "@/components/ng/input";
import { Icon } from "@/components/ui/icon";
import { BellIcon } from "@/components/ui/bell-icon";
import { cn } from "@/lib/utils";

/**
 * AnnouncementsPanel — the REAL manager for the storefront top-marquee evergreen
 * lines, backed by the `announcements` table (super-admin
 * `/api/admin/marketing/announcements`). Lists every line with its sort + active
 * state and supports create / edit / activate-pause / delete.
 *
 * These are the always-on notices (free shipping, new arrivals, membership) that
 * scroll AFTER any live promotion line in the PromoBar. `sort` orders them in the
 * bar (ascending); a paused line is hidden without being deleted. The types here
 * are declared locally — the data-access lib is server-only and must not be
 * imported into this client component.
 */

interface AnnouncementRow {
  id: string;
  text: string;
  active: boolean;
  sort: number;
}

interface FormState {
  text: string;
  active: boolean;
  sort: string;
}

const EMPTY: FormState = { text: "", active: true, sort: "0" };

export function AnnouncementsPanel() {
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/marketing/announcements", { cache: "no-store" });
      if (!res.ok) {
        setRows([]);
        return;
      }
      const json = (await res.json()) as { announcements?: AnnouncementRow[] };
      setRows(json.announcements ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
  }

  function openEdit(a: AnnouncementRow) {
    setEditingId(a.id);
    setForm({ text: a.text, active: a.active, sort: String(a.sort) });
    if (typeof document !== "undefined") {
      document
        .getElementById("announcements")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function submit() {
    const text = form.text.trim();
    if (!text) {
      toast.error("Enter the announcement text.");
      return;
    }
    const parsedSort = Number(form.sort);
    const body = {
      text,
      active: form.active,
      sort: Number.isFinite(parsedSort) ? Math.round(parsedSort) : 0,
    };

    setSaving(true);
    try {
      const url = editingId
        ? `/api/admin/marketing/announcements/${editingId}`
        : "/api/admin/marketing/announcements";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(
          json.error === "text-required"
            ? "Announcement text required."
            : `Couldn't save${json.error ? ` (${json.error})` : ""}.`,
        );
        return;
      }
      toast.success(editingId ? "Announcement updated" : "Announcement added");
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function setActive(a: AnnouncementRow, active: boolean) {
    // Optimistic — flip the status locally so it reflects instantly, with no full
    // list reload (which is what made the page stutter / the scroll jump).
    setRows((prev) => prev.map((r) => (r.id === a.id ? { ...r, active } : r)));
    try {
      const res = await fetch(`/api/admin/marketing/announcements/${a.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("update-failed");
      toast.success(active ? "Announcement activated" : "Announcement paused");
    } catch {
      // Revert on failure.
      setRows((prev) => prev.map((r) => (r.id === a.id ? { ...r, active: !active } : r)));
      toast.error("Couldn't update announcement.");
    }
  }

  async function remove(a: AnnouncementRow) {
    if (typeof window !== "undefined" && !window.confirm(`Delete this line?\n\n“${a.text}”`)) {
      return;
    }
    // Optimistic — drop it locally right away; restore on failure.
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== a.id));
    if (editingId === a.id) resetForm();
    try {
      const res = await fetch(`/api/admin/marketing/announcements/${a.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete-failed");
      toast.success("Announcement deleted");
    } catch {
      setRows(prev);
      toast.error("Couldn't delete announcement.");
    }
  }

  return (
    <section
      id="announcements"
      className="mb-6 scroll-mt-32 rounded-3xl border border-ng-line-soft bg-ng-paper p-6 shadow-[var(--shadow-ng-card)]"
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-ng-forest/10 text-ng-forest">
          <BellIcon size={20} animated />
        </span>
        <div>
          <h2 className="font-display text-[22px] leading-tight text-ng-forest-deep">
            Top-bar announcements
          </h2>
          <p className="text-[13px] text-ng-ink-muted">
            Evergreen lines that scroll in the marquee after any live sale — edit without a deploy.
          </p>
        </div>
      </div>

      {/* Create / edit form */}
      <div className="mb-6 grid gap-3 rounded-2xl border border-ng-line-soft bg-ng-sage/20 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <Input
          label="Announcement"
          placeholder="Free shipping on orders over ₹599 · Across India"
          value={form.text}
          onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
        />
        <Input
          label="Sort"
          inputMode="numeric"
          placeholder="0"
          value={form.sort}
          onChange={(e) => setForm((f) => ({ ...f, sort: e.target.value.replace(/[^\d-]/g, "") }))}
          className="w-full sm:w-16"
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={() => void submit()}
            disabled={saving}
            className="h-11"
          >
            {saving ? "Saving…" : editingId ? "Save" : "Add line"}
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={resetForm}
              disabled={saving}
              className="h-11"
            >
              Cancel
            </Button>
          ) : null}
        </div>

        {/* Active toggle */}
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-ng-line-soft bg-ng-paper px-4 py-3 sm:col-span-3">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            className="h-4 w-4 shrink-0 accent-ng-forest"
          />
          <span className="text-[13px] leading-snug text-ng-ink">
            <span className="font-semibold text-ng-forest-deep">Active</span> — show this line in the
            storefront top bar
          </span>
        </label>
      </div>

      {/* List */}
      {loading ? (
        <p className="py-6 text-center text-[14px] text-ng-ink-muted">Loading announcements…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-ng-ink-muted">
          No announcements yet — add your first line above.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-ng-line-soft">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-ng-sage/30 text-ng-forest-deep">
              <tr>
                <th className="px-5 py-3 font-semibold">Announcement</th>
                <th className="px-5 py-3 font-semibold text-right">Sort</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ng-line-soft">
              {rows.map((a) => (
                <tr key={a.id} className="bg-ng-paper">
                  <td className="px-5 py-3.5 text-ng-ink">
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden className="text-ng-clay">
                        ◆
                      </span>
                      {a.text}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 tabular-nums text-ng-ink-muted text-right">{a.sort}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        a.active ? "bg-ng-green-bright/15 text-ng-forest" : "bg-ng-line text-ng-ink-soft",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          a.active ? "bg-ng-green-bright" : "bg-ng-ink-soft",
                        )}
                      />
                      {a.active ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => void setActive(a, !a.active)}
                        className="text-[12.5px] font-semibold text-ng-ink-muted transition-colors hover:text-ng-forest"
                      >
                        {a.active ? "Pause" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(a)}
                        className="text-[12.5px] font-semibold text-ng-forest transition-colors hover:text-ng-leaf"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(a)}
                        className="text-[12.5px] font-semibold text-ng-danger transition-colors hover:opacity-70"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
