"use client";

import { useState, type ReactNode } from "react";
import { CommunityPicker, type PickedCommunity } from "@/components/ng/admin/community-picker";
import { TextField } from "@/components/ng/admin/super/controls";
import { Icon } from "@/components/ui/icon";
import { communityKey, communityName, withPincode } from "@/lib/community-label";

/**
 * The gated communities a coupon is limited to, and the pincodes that fence them.
 *
 * Checkout looks for the community's name in the customer's delivery address. A
 * name alone is not enough: there is a Green Park in most Indian cities. So
 * picking a community from the map also adds its pincode, and because pincode and
 * community are both required, the code can't match a same-named society
 * elsewhere.
 *
 * The pincodes are shown and left editable, as plain text, for three reasons. A
 * typed community has none, and it can't pass the pincode check unless its own is
 * added here. Google has no postal code for some places. And the two lists are
 * stored separately, so after a reload nothing links a community to its pincode:
 * only the operator can tell which one to take out when removing a society.
 */

const PINCODE = /^\d{6}$/;

type Note = "typed" | "no-pincode";

export function CouponCommunityField({
  communities,
  onCommunities,
  pincodes,
  onPincodes,
}: {
  communities: string[];
  onCommunities: (next: string[]) => void;
  /** Comma-separated, as typed. */
  pincodes: string;
  /**
   * Takes an updater, not a value. A pick's pincode arrives after a network call,
   * by which time the form may have moved on, so it must apply to the latest text.
   */
  onPincodes: (update: (current: string) => string) => void;
}) {
  // Picks that need the operator's eye. Only known for this session: a saved
  // coupon doesn't record how each of its communities got there.
  const [notes, setNotes] = useState<Record<string, Note>>({});

  function onPick({ name, fromPlaces, address }: PickedCommunity) {
    const pincode = address?.pincode ?? "";
    if (PINCODE.test(pincode)) onPincodes((current) => withPincode(current, pincode));
    else setNotes((n) => ({ ...n, [communityKey(name)]: fromPlaces ? "no-pincode" : "typed" }));
  }

  const noted = (note: Note) =>
    communities.filter((c) => notes[communityKey(c)] === note).map(communityName);
  const noPincode = noted("no-pincode");
  // Only matters once a pincode is listed. With none, nothing fences the code and
  // a typed community passes on its name alone.
  const typed = pincodes.trim() ? noted("typed") : [];

  return (
    <div className="flex flex-col gap-3">
      <CommunityPicker
        value={communities}
        onChange={onCommunities}
        onPick={onPick}
        label="Gated communities"
        hint="Search the map, or type a name and press Enter. Checkout looks for this name in the customer's delivery address."
      />

      <TextField
        label="Community pincodes"
        value={pincodes}
        onChange={(next) => onPincodes(() => next)}
        placeholder="500075, 500032"
        hint="Filled in when you pick from the map. If any are listed, the customer's pincode must be one of them, so a society with the same name in another city can't match."
      />

      {noPincode.length > 0 ? (
        <CommunityNote>
          Google has no pincode for <strong>{noPincode.join(", ")}</strong>. Add it above, or an
          address with this name in any city will qualify.
        </CommunityNote>
      ) : null}

      {typed.length > 0 ? (
        <CommunityNote>
          <strong>{typed.join(", ")}</strong> was typed in, so it has no pincode yet. Customers
          there only qualify if their pincode is listed above.
        </CommunityNote>
      ) : null}
    </div>
  );
}

function CommunityNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-ng-clay/40 bg-ng-clay/[0.07] px-3 py-2.5 text-[12px] font-medium leading-relaxed text-ng-ink">
      <Icon name="danger-triangle-bold" size={14} className="mt-0.5 shrink-0 text-ng-clay-deep" />
      <span>{children}</span>
    </p>
  );
}
