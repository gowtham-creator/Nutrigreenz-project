"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getAdminRole } from "@/lib/admin-auth";
import { AdminShell, Card } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { JournalModal, type Journal, type JournalDraft } from "./journal-modal";

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

const CATEGORY_TONE: Record<string, string> = {
  science: "bg-ng-forest text-ng-cream",
  "field-notes": "bg-ng-clay text-ng-forest-deep",
  recipes: "bg-ng-terracotta text-ng-cream",
  guides: "bg-ng-leaf text-ng-forest-deep",
};

export default function AdminJournal() {
  const [articles, setArticles] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuper, setIsSuper] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Journal | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Journal | null>(null);

  useEffect(() => {
    setIsSuper(getAdminRole() === "superadmin");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/journal");
      const data = (await res.json()) as { ok: boolean; journals: Journal[] };
      if (data.ok) setArticles(data.journals);
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
  const openEdit = (a: Journal) => {
    setEditing(a);
    setOpen(true);
  };

  const saveArticle = useCallback(
    async (draft: JournalDraft) => {
      setSaving(true);
      const payload = {
        title: draft.title.trim(),
        slug: draft.slug.trim() || undefined,
        excerpt: draft.excerpt.trim(),
        body: draft.body,
        author: draft.author.trim(),
        category: draft.category,
        readMinutes: Math.max(1, Math.round(Number(draft.readMinutes) || 5)),
        tags: draft.tags,
        publishedAt: draft.publishedAt || null,
        cover: draft.cover.trim() || null,
      };
      try {
        if (editing) {
          await postJson(`/api/admin/journal/${editing.id}`, "PATCH", payload);
          toast.success("Article updated", { description: payload.title });
        } else {
          await postJson("/api/admin/journal", "POST", payload);
          toast.success("Article created", { description: payload.title });
        }
        setOpen(false);
        await load();
      } catch {
        toast.error("Couldn't save the article", { description: "Try again." });
      } finally {
        setSaving(false);
      }
    },
    [editing, load],
  );

  const removeArticle = useCallback(
    async (a: Journal) => {
      setConfirmDel(null);
      try {
        await postJson(`/api/admin/journal/${a.id}`, "DELETE", {});
        toast.success("Article removed", { description: a.title });
        await load();
      } catch {
        toast.error("Couldn't remove the article. Try again.");
      }
    },
    [load],
  );

  return (
    <AdminShell
      active="/admin/journal"
      title="Journal"
      subtitle="Long-form articles shown on the storefront Journal."
      actions={
        isSuper ? (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer"
          >
            <Icon name="add-circle-bold" size={16} />
            Add article
          </button>
        ) : null
      }
    >
      {!isSuper ? (
        <div className="mb-6 rounded-2xl bg-ng-clay/15 border border-ng-clay/30 px-5 py-3 text-[13px] font-medium text-ng-forest-deep">
          You can view articles here. Only Super Admins can add, edit or remove them.
        </div>
      ) : null}

      {loading ? (
        <div className="grid place-items-center py-20 text-ng-ink-muted">
          <Icon name="refresh-bold" size={22} className="animate-spin" />
        </div>
      ) : articles.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <p className="text-[15px] text-ng-ink-muted">No articles yet.</p>
            {isSuper ? (
              <button
                type="button"
                onClick={openAdd}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer"
              >
                <Icon name="add-circle-bold" size={16} />
                Add your first article
              </button>
            ) : null}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {articles.map((a) => (
            <article
              key={a.id}
              className="flex flex-col rounded-2xl bg-ng-paper border border-ng-line-soft overflow-hidden"
            >
              <div className="relative aspect-[16/9] bg-ng-line-soft overflow-hidden">
                {a.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.cover} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-ng-ink-muted">
                    <Icon name="gallery-bold" size={26} />
                  </div>
                )}
                <span
                  className={`absolute top-3 left-3 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full ${
                    CATEGORY_TONE[a.category] ?? "bg-ng-sage text-ng-forest-deep"
                  }`}
                >
                  {a.category.replace("-", " ")}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-display text-[17px] leading-tight text-ng-forest-deep line-clamp-2">
                  {a.title}
                </h3>
                <p className="mt-2 text-[13px] text-ng-ink-muted leading-relaxed line-clamp-2 flex-1">
                  {a.excerpt}
                </p>
                <div className="mt-4 pt-3 border-t border-ng-line-soft flex items-center justify-between">
                  <span className="text-[11.5px] text-ng-ink-soft">
                    {a.publishedAt
                      ? new Date(a.publishedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}{" "}
                    · {a.readMinutes} min
                  </span>
                  {isSuper ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(a)}
                        aria-label={`Edit ${a.title}`}
                        className="grid size-8 place-items-center rounded-full text-ng-ink-muted hover:bg-ng-line-soft hover:text-ng-forest-deep transition-colors cursor-pointer"
                      >
                        <UiIcon name="edit" size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDel(a)}
                        aria-label={`Delete ${a.title}`}
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
        <JournalModal
          key={editing?.id ?? "new"}
          open
          article={editing}
          saving={saving}
          onClose={() => setOpen(false)}
          onSave={saveArticle}
        />
      )}

      {confirmDel ? (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-ng-forest-deep/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-ng-paper border border-ng-line-soft shadow-[var(--shadow-ng-modal)] p-6">
            <h3 className="font-display text-[18px] text-ng-forest-deep">Delete this article?</h3>
            <p className="mt-2 text-[13px] text-ng-ink-muted">
              “{confirmDel.title}” will be removed from the storefront Journal. This cannot be undone.
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
                onClick={() => void removeArticle(confirmDel)}
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
