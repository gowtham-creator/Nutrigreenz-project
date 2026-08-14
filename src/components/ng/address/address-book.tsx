"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { useAddresses, type AddressInput } from "@/lib/addresses";
import { useAuth } from "@/lib/auth";
import type { Address } from "@/types/nutrigreenz";
import { AddressCard } from "./address-card";
import { AddressForm } from "./address-form";

type Editor =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; address: Address };

export function AddressBook() {
  const { addresses, add, update, remove, setDefault } = useAddresses();
  const { account, importGoogleProfile } = useAuth();
  const [editor, setEditor] = useState<Editor>({ mode: "closed" });
  const [importing, setImporting] = useState(false);

  // On-demand Google import — deterministic fallback for the sign-in-time
  // enrichment (usable whenever the Google account gains an address later).
  const canImportFromGoogle = account?.method === "google";

  async function handleImportFromGoogle() {
    setImporting(true);
    try {
      const result = await importGoogleProfile();
      if (result && result.addressesAdded > 0) {
        toast.success(
          `Imported ${result.addressesAdded} address${result.addressesAdded > 1 ? "es" : ""} from your Google account`,
        );
      } else if (result) {
        toast.info(
          "No new address found on your Google profile. Add one at myaccount.google.com → Personal info → Addresses, then try again.",
        );
      } else {
        toast.info(
          "Couldn't read your Google profile. Approve the address permission in the popup and try again.",
        );
      }
    } finally {
      setImporting(false);
    }
  }

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
        <div className="flex flex-wrap items-center gap-2.5">
          {canImportFromGoogle ? (
            <Button
              variant="secondary"
              onClick={handleImportFromGoogle}
              disabled={importing}
              aria-label="Import your address from Google"
            >
              <Icon name="cloud-download-linear" size={18} />
              {importing ? "Importing…" : "Import from Google"}
            </Button>
          ) : null}
          <Button
            variant="primary"
            onClick={() => setEditor({ mode: "add" })}
            aria-label="Add a new address"
          >
            <Icon name="add-circle-linear" size={18} />
            Add new address
          </Button>
        </div>
      </div>

      {addresses.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-ng-line bg-ng-sage/20 p-12 text-center">
          <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-ng-paper text-ng-clay-deep shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
            <Icon name="map-point-bold" size={30} />
          </span>
          <p className="font-display text-[22px] leading-tight text-ng-forest-deep">
            No addresses yet
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-ng-ink-muted">
            Add a delivery address to check out faster next time. We&apos;ll keep your home, work
            and other spots ready for one-tap orders.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            {canImportFromGoogle ? (
              <Button variant="secondary" onClick={handleImportFromGoogle} disabled={importing}>
                <Icon name="cloud-download-linear" size={18} />
                {importing ? "Importing…" : "Import from Google"}
              </Button>
            ) : null}
            <Button variant="primary" onClick={() => setEditor({ mode: "add" })}>
              <Icon name="add-circle-linear" size={18} />
              Add your first address
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid items-stretch gap-5 sm:grid-cols-2">
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

      {open && typeof document !== "undefined" ? (
        // PORTALED to <body>: ancestor transform/opacity wrappers (Reveal etc.)
        // create stacking contexts that would trap the overlay UNDER the sticky
        // header no matter its z-index — rendering at the body root sidesteps
        // that entirely.
        // Scroll lives on the OUTER overlay; centring on an inner `min-h-full`
        // wrapper. Keeping the two separate means a form taller than the screen
        // grows the wrapper and the whole modal scrolls — so the top (heading)
        // and bottom (Save/Cancel) are always reachable, on mobile and desktop.
        createPortal(<div
          className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-ng-soil/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex min-h-full items-start justify-center p-4 sm:items-center"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setEditor({ mode: "closed" });
            }}
          >
            <div className="w-full max-w-xl rounded-3xl bg-ng-paper p-6 shadow-[0_24px_60px_rgba(20,51,31,0.28)] sm:p-8">
              <AddressForm
                initial={editor.mode === "edit" ? editor.address : undefined}
                onSubmit={handleSubmit}
                onCancel={() => setEditor({ mode: "closed" })}
              />
            </div>
          </div>
        </div>, document.body)
      ) : null}
    </div>
  );
}
