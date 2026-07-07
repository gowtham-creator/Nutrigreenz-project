"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { Category } from "./types";

const FIELD =
  "rounded-xl bg-ng-paper border border-ng-line-soft px-3.5 py-2 text-[13px] text-ng-ink outline-none focus:border-ng-forest transition-colors";

export function CategoryModal({
  open,
  categories,
  busy,
  onClose,
  onCreate,
  onRename,
  onDelete,
}: {
  open: boolean;
  categories: readonly Category[];
  busy: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  if (!open) return null;

  const startEdit = (c: Category) => {
    setEditId(c.id);
    setEditName(c.name);
  };

  const commitEdit = () => {
    if (editId && editName.trim()) onRename(editId, editName.trim());
    setEditId(null);
    setEditName("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ng-forest-deep/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Manage categories"
    >
      <div className="w-full max-w-md rounded-2xl bg-ng-paper border border-ng-line-soft shadow-[var(--shadow-ng-modal)] max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 border-b border-ng-line-soft">
          <h2 className="font-display text-[19px] text-ng-forest-deep">Categories</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ng-ink-muted hover:text-ng-ink transition-colors cursor-pointer"
          >
            <Icon name="close-circle-bold" size={20} />
          </button>
        </header>

        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-5">
            <input
              className={`${FIELD} flex-1`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New category name"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  onCreate(newName.trim());
                  setNewName("");
                }
              }}
            />
            <button
              type="button"
              disabled={busy || !newName.trim()}
              onClick={() => {
                onCreate(newName.trim());
                setNewName("");
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="add-circle-bold" size={15} />
              Add
            </button>
          </div>

          {categories.length === 0 ? (
            <p className="text-[13px] font-medium text-ng-ink-muted">No categories yet.</p>
          ) : (
            <ul className="divide-y divide-ng-line-soft">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center gap-2 py-2.5">
                  {editId === c.id ? (
                    <>
                      <input
                        className={`${FIELD} flex-1`}
                        value={editName}
                        autoFocus
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                      />
                      <button
                        type="button"
                        onClick={commitEdit}
                        className="text-[12px] font-bold text-ng-forest hover:text-ng-leaf transition-colors cursor-pointer"
                      >
                        Save
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-[13px] font-semibold text-ng-ink">{c.name}</span>
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        aria-label={`Rename ${c.name}`}
                        className="inline-flex items-center gap-1 text-[12px] font-bold text-ng-forest hover:text-ng-leaf transition-colors cursor-pointer"
                      >
                        <Icon name="pen-2-bold" size={13} />
                        Rename
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onDelete(c.id)}
                        aria-label={`Delete ${c.name}`}
                        className="inline-flex items-center gap-1 text-[12px] font-bold text-ng-terracotta hover:text-ng-terracotta/80 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Icon name="trash-bin-trash-bold" size={13} />
                        Delete
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
