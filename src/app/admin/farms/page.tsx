"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getAdminRole } from "@/lib/admin-auth";
import { AdminShell, Card } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { FarmModal, type Farm, type FarmDraft } from "./farm-modal";

async function postJson<T>(url: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) throw new Error(data.error || "request-failed");
  return data;
}

export default function AdminFarms() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuper, setIsSuper] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Farm | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Farm | null>(null);

  useEffect(() => {
    setIsSuper(getAdminRole() === "superadmin");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/farms");
      const data = (await res.json()) as { ok: boolean; farms: Farm[] };
      if (data.ok) setFarms(data.farms);
    } catch {
      /* leave list as-is */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (f: Farm) => {
    setEditing(f);
    setOpen(true);
  };

  const saveFarm = useCallback(
    async (draft: FarmDraft) => {
      setSaving(true);
      const payload = {
        name: draft.name.trim(),
        region: draft.region.trim(),
        hectares: draft.hectares.trim() === "" ? null : Number(draft.hectares),
        farmerName: draft.farmerName.trim() || null,
        partneredSince: draft.partneredSince || null,
        practices: draft.practices,
        story: draft.story.trim() || null,
        image: draft.image.trim() || null,
        gallery: draft.gallery,
      };
      try {
        if (editing) {
          await postJson(`/api/admin/farms/${editing.id}`, "PATCH", payload);
          toast.success("Farm updated", { description: payload.name });
        } else {
          await postJson("/api/admin/farms", "POST", payload);
          toast.success("Farm created", { description: payload.name });
        }
        setOpen(false);
        await load();
      } catch {
        toast.error("Could not save farm", { description: "Please try again." });
      } finally {
        setSaving(false);
      }
    },
    [editing, load],
  );

  const removeFarm = useCallback(
    async (f: Farm) => {
      setConfirmDel(null);
      try {
        await postJson(`/api/admin/farms/${f.id}`, "DELETE", {});
        toast.success("Farm removed", { description: f.name });
        await load();
      } catch {
        toast.error("Could not remove farm");
      }
    },
    [load],
  );

  return (
    <AdminShell
      active="/admin/farms"
      title="Farms"
      subtitle="Partner farms shown on the storefront Farms directory."
      actions={
        isSuper ? (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer"
          >
            <Icon name="add-circle-bold" size={16} />
            Add farm
          </button>
        ) : null
      }
    >
      {!isSuper ? (
        <div className="mb-6 rounded-2xl bg-ng-clay/15 border border-ng-clay/30 px-5 py-3 text-[13px] font-medium text-ng-forest-deep">
          You can review the Farms directory here. Adding, editing and removing farms is reserved for Super Admins.
        </div>
      ) : null}

      {loading ? (
        <div className="grid place-items-center py-20 text-ng-ink-muted">
          <Icon name="refresh-bold" size={22} className="animate-spin" />
        </div>
      ) : farms.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <p className="text-[15px] text-ng-ink-muted">No farms yet.</p>
            {isSuper ? (
              <button
                type="button"
                onClick={openAdd}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer"
              >
                <Icon name="add-circle-bold" size={16} />
                Add your first farm
              </button>
            ) : null}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {farms.map((f) => (
            <article
              key={f.id}
              className="flex flex-col rounded-2xl bg-ng-paper border border-ng-line-soft overflow-hidden"
            >
              <div className="relative aspect-[16/9] bg-ng-line-soft overflow-hidden">
                {f.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-ng-ink-muted">
                    <Icon name="gallery-bold" size={26} />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-display text-[17px] leading-tight text-ng-forest-deep">{f.name}</h3>
                <p className="mt-1 text-[12.5px] text-ng-ink-soft">
                  {f.region}
                  {f.hectares != null ? ` · ${f.hectares} ha` : ""}
                </p>
                <p className="mt-2 text-[13px] text-ng-ink-muted leading-relaxed line-clamp-2 flex-1">
                  {f.story ?? ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {f.practices.slice(0, 3).map((p) => (
                    <span
                      key={p}
                      className="text-[10.5px] px-2 py-0.5 rounded-full bg-ng-cream border border-ng-forest-deep/25 text-ng-forest-deep capitalize"
                    >
                      {p}
                    </span>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-ng-line-soft flex items-center justify-between">
                  <span className="text-[11.5px] text-ng-ink-soft">
                    {f.partneredSince
                      ? `Since ${new Date(f.partneredSince).getFullYear()}`
                      : "—"}
                  </span>
                  {isSuper ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(f)}
                        aria-label={`Edit ${f.name}`}
                        className="grid size-8 place-items-center rounded-full text-ng-ink-muted hover:bg-ng-line-soft hover:text-ng-forest-deep transition-colors cursor-pointer"
                      >
                        <Icon name="pen-2-bold" size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDel(f)}
                        aria-label={`Delete ${f.name}`}
                        className="grid size-8 place-items-center rounded-full text-ng-ink-muted hover:bg-ng-terracotta/10 hover:text-ng-terracotta transition-colors cursor-pointer"
                      >
                        <Icon name="trash-bin-trash-bold" size={15} />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {open && (
        <FarmModal
          key={editing?.id ?? "new"}
          open
          farm={editing}
          saving={saving}
          onClose={() => setOpen(false)}
          onSave={saveFarm}
        />
      )}

      {confirmDel ? (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-ng-forest-deep/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-ng-paper border border-ng-line-soft shadow-[var(--shadow-ng-modal)] p-6">
            <h3 className="font-display text-[18px] text-ng-forest-deep">Delete this farm?</h3>
            <p className="mt-2 text-[13px] text-ng-ink-muted">
              “{confirmDel.name}” will be removed from the storefront Farms directory. This cannot be undone.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDel(null)}
                className="rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void removeFarm(confirmDel)}
                className="inline-flex items-center gap-1.5 rounded-full bg-ng-terracotta text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Icon name="trash-bin-trash-bold" size={15} />
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
