"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { useAddresses, type AddressInput } from "@/lib/addresses";
import type { Address } from "@/types/nutrigreenz";
import { AddressCard } from "./address-card";
import { AddressForm } from "./address-form";

type Editor =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; address: Address };

export function AddressBook() {
  const { addresses, add, update, remove, setDefault } = useAddresses();
  const [editor, setEditor] = useState<Editor>({ mode: "closed" });

  const open = editor.mode !== "closed";

  // Lock body scroll + close on Escape while the modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditor({ mode: "closed" });
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleSubmit(input: AddressInput) {
    if (editor.mode === "edit") {
      update(editor.address.id, input);
      toast.success("Address updated");
    } else {
      add(input);
      toast.success("Address added");
    }
    setEditor({ mode: "closed" });
  }

  function handleDelete(id: string) {
    remove(id);
    toast.success("Address removed");
  }

  function handleSetDefault(id: string) {
    setDefault(id);
    toast.success("Default address updated");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-ng-ink-muted">
          {addresses.length} saved
          {addresses.length > 0 ? " · 1 default" : ""}
        </p>
        <Button
          variant="primary"
          onClick={() => setEditor({ mode: "add" })}
          aria-label="Add a new address"
        >
          <Icon name="add-circle-linear" size={18} />
          Add new address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-ng-line bg-ng-sage/20 p-12 text-center">
          <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-ng-paper text-ng-clay shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
            <Icon name="map-point-bold" size={30} />
          </span>
          <p className="font-display text-[22px] leading-tight text-ng-forest-deep">
            No addresses yet
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-ng-ink-muted">
            Add a delivery address to check out faster next time. We&apos;ll keep your home, work
            and other spots ready for one-tap orders.
          </p>
          <div className="mt-6 flex justify-center">
            <Button variant="primary" onClick={() => setEditor({ mode: "add" })}>
              <Icon name="add-circle-linear" size={18} />
              Add your first address
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={(a) => setEditor({ mode: "edit", address: a })}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
            />
          ))}
        </div>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ng-soil/40 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditor({ mode: "closed" });
          }}
        >
          <div className="my-8 w-full max-w-xl rounded-3xl bg-ng-paper p-6 shadow-[0_24px_60px_rgba(20,51,31,0.28)] sm:p-8">
            <AddressForm
              initial={editor.mode === "edit" ? editor.address : undefined}
              onSubmit={handleSubmit}
              onCancel={() => setEditor({ mode: "closed" })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
