"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { ImageField } from "@/components/ng/admin/image-picker";

/** A journal article as returned by /api/admin/journal. */
export interface Journal {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover: string;
  author: string;
  category: string;
  readMinutes: number;
  tags: string[];
  publishedAt: string;
  sort: number;
}

export interface JournalDraft {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  cover: string;
  author: string;
  category: string;
  readMinutes: string;
  tags: string;
  publishedAt: string;
}

/** The four categories the storefront has colour tones for. */
const CATEGORY_OPTIONS = ["science", "field-notes", "recipes", "guides"] as const;

const FIELD =
  "w-full rounded-xl bg-ng-paper border border-ng-line-soft px-3.5 py-2.5 text-[13px] text-ng-ink outline-none focus:border-ng-forest transition-colors";
const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted mb-1.5";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function draftFrom(a: Journal | null): JournalDraft {
  return {
    title: a?.title ?? "",
    slug: a?.slug ?? "",
    excerpt: a?.excerpt ?? "",
    body: a?.body ?? "",
    cover: a?.cover ?? "",
    author: a?.author ?? "Nutrigreenz Field Desk",
    category: a?.category ?? "science",
    readMinutes: a ? String(a.readMinutes) : "5",
    tags: a?.tags?.join(", ") ?? "",
    publishedAt: a?.publishedAt ? a.publishedAt.slice(0, 10) : today(),
  };
}

export function JournalModal({
  open,
  article,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  article: Journal | null;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: JournalDraft) => void;
}) {
  const [draft, setDraft] = useState<JournalDraft>(() => draftFrom(article));

  if (!open) return null;

  const set = <K extends keyof JournalDraft>(key: K, value: JournalDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const canSave = draft.title.trim().length > 0 && !saving;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ng-forest-deep/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={article ? "Edit article" : "Add article"}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-ng-paper border border-ng-line-soft shadow-[var(--shadow-ng-modal)] max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 border-b border-ng-line-soft">
          <h2 className="font-display text-[19px] text-ng-forest-deep">
            {article ? "Edit article" : "Add article"}
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
          <div>
            <label className={LABEL} htmlFor="nj-title">Title</label>
            <input
              id="nj-title"
              className={FIELD}
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Why bilona is the only ghee method we'll ever use"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL} htmlFor="nj-slug">Slug</label>
              <input
                id="nj-slug"
                className={FIELD}
                value={draft.slug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="auto-generated from title"
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="nj-author">Author</label>
              <input
                id="nj-author"
                className={FIELD}
                value={draft.author}
                onChange={(e) => set("author", e.target.value)}
                placeholder="Nutrigreenz Field Desk"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={LABEL} htmlFor="nj-category">Category</label>
              <select
                id="nj-category"
                className={FIELD}
                value={draft.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c.replace("-", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="nj-read">Read (min)</label>
              <input
                id="nj-read"
                type="number"
                min={1}
                className={FIELD}
                value={draft.readMinutes}
                onChange={(e) => set("readMinutes", e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="nj-date">Published</label>
              <input
                id="nj-date"
                type="date"
                className={FIELD}
                value={draft.publishedAt}
                onChange={(e) => set("publishedAt", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="nj-excerpt">Excerpt / dek</label>
            <textarea
              id="nj-excerpt"
              rows={2}
              className={`${FIELD} resize-none`}
              value={draft.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
              placeholder="One or two sentences shown on the card and as the article lead."
            />
          </div>

          <div>
            <label className={LABEL} htmlFor="nj-body">Body (HTML)</label>
            <textarea
              id="nj-body"
              rows={8}
              className={`${FIELD} font-mono text-[12px] leading-relaxed`}
              value={draft.body}
              onChange={(e) => set("body", e.target.value)}
              placeholder="<p>…</p><h2>…</h2><blockquote>…<footer>—</footer></blockquote>"
            />
            <p className="mt-1 text-[10.5px] font-medium text-ng-ink-muted">
              Rendered inside the article body. Use &lt;p&gt;, &lt;h2&gt; and &lt;blockquote&gt; tags.
            </p>
          </div>

          <div>
            <label className={LABEL} htmlFor="nj-tags">Tags</label>
            <input
              id="nj-tags"
              className={FIELD}
              value={draft.tags}
              onChange={(e) => set("tags", e.target.value)}
              placeholder="comma, separated, tags"
            />
          </div>

          <ImageField
            label="Cover image"
            value={draft.cover}
            onChange={(v) => set("cover", v)}
            hint="Shown as the card cover and the hero banner."
          />
        </div>

        <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-ng-line-soft">
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
            onClick={() => onSave(draft)}
            className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="diskette-bold" size={15} />
            {saving ? "Saving…" : article ? "Save changes" : "Create article"}
          </button>
        </footer>
      </div>
    </div>
  );
}
