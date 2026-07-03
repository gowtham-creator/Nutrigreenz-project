"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ng/button";
import { Input } from "@/components/ng/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import type { AddressInput } from "@/lib/addresses";
import {
  autocompleteAddress,
  fetchPlaceAddress,
  isPlacesConfigured,
  newSessionToken,
  type PlaceSuggestion,
} from "@/lib/places-client";
import type { Address } from "@/types/nutrigreenz";

type AddressType = Address["type"];

interface AddressFormProps {
  /** Existing address when editing; omit for a fresh add. */
  initial?: Address;
  onSubmit: (input: AddressInput) => void;
  onCancel: () => void;
}

const TYPE_OPTIONS: { value: AddressType; label: string; icon: string }[] = [
  { value: "home", label: "Home", icon: "home-2-bold" },
  { value: "work", label: "Work", icon: "buildings-2-bold" },
  { value: "other", label: "Other", icon: "map-point-bold" },
];

interface FormState {
  fullName: string;
  phone: string;
  line1: string; // Building / Floor / Flat
  line2: string; // Road / Street
  area: string; // Area / Locality (autofilled by search)
  landmark: string; // Landmark — optional
  city: string;
  pincode: string;
  region: string;
  state: string;
  country: string;
  type: AddressType;
  label: string;
}

function toFormState(a?: Address): FormState {
  return {
    fullName: a?.fullName ?? "",
    phone: a?.phone ?? "",
    line1: a?.line1 ?? "",
    line2: a?.line2 ?? "",
    area: "",
    landmark: a?.landmark ?? "",
    city: a?.city ?? "",
    pincode: a?.pincode ?? "",
    region: "",
    state: a?.state ?? "",
    country: "India",
    type: a?.type ?? "home",
    label: a?.label ?? "",
  };
}

type Errors = Partial<Record<keyof FormState, string>>;

export function AddressForm({ initial, onSubmit, onCancel }: AddressFormProps) {
  const { account } = useAuth();
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [errors, setErrors] = useState<Errors>({});

  // Prefill the recipient from the signed-in account (Google name / login
  // phone) on a fresh add — still editable for gifting to someone else.
  useEffect(() => {
    if (initial) return;
    setForm((prev) => ({
      ...prev,
      fullName: prev.fullName || account?.name || "",
      phone: prev.phone || account?.phone || "",
    }));
  }, [account, initial]);

  // ── Google Places search (optional; renders only when a key is configured).
  // One session token per search→pick cycle keeps billing on the cheap
  // session SKU; picking a suggestion autofills street/area/city/pincode/state.
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const sessionRef = useRef<string>(newSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isPlacesConfigured) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        setSuggestions(await autocompleteAddress(query, sessionRef.current));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function pickSuggestion(s: PlaceSuggestion) {
    setSuggestions([]);
    setQuery(s.text);
    const parsed = await fetchPlaceAddress(s.placeId, sessionRef.current);
    // A pick ends the billing session — mint a fresh token for the next search.
    sessionRef.current = newSessionToken();
    if (!parsed) return;
    // Building / society name: Google's premise component when present, else
    // the suggestion's leading segment (e.g. "Saraswathi Nilayam, …") as long
    // as it isn't just the road repeated.
    const lead = s.text.split(",")[0]?.trim() ?? "";
    const building =
      parsed.building ||
      (lead && lead !== parsed.street && lead !== parsed.area && lead !== parsed.city ? lead : "");
    setForm((prev) => ({
      ...prev,
      line1: prev.line1 || building,
      line2: parsed.street || prev.line2,
      area: parsed.area || prev.area,
      city: parsed.city || prev.city,
      state: parsed.state || prev.state,
      pincode: parsed.pincode || prev.pincode,
    }));
    setErrors((prev) => ({ ...prev, city: undefined, state: undefined, pincode: undefined }));
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Errors = {};
    if (!form.fullName.trim()) next.fullName = "Full name is required.";
    if (!/^[+\d][\d\s-]{7,}$/.test(form.phone.trim()))
      next.phone = "Enter a valid phone number.";
    if (!form.line1.trim())
      next.line1 = "Building / floor / flat is required.";
    if (!form.city.trim()) next.city = "City is required.";
    if (!/^\d{6}$/.test(form.pincode.trim()))
      next.pincode = "Enter a 6-digit pincode.";
    if (!form.state.trim()) next.state = "State is required.";
    if (form.type === "other" && !form.label.trim())
      next.label = "Add a label for this address.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    // Fold the Area + optional Region into line2 so we keep the shared Address shape.
    const street = [form.line2.trim(), form.area.trim(), form.region.trim()]
      .filter(Boolean)
      .join(", ");
    const input: AddressInput = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      line1: form.line1.trim(),
      line2: street || undefined,
      landmark: form.landmark.trim() || undefined,
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      type: form.type,
      label: form.type === "other" ? form.label.trim() || undefined : undefined,
      isDefault: initial?.isDefault,
    };
    onSubmit(input);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <h3 className="font-display text-[22px] text-ng-forest-deep">
        {initial ? "Edit address" : "Add a new address"}
      </h3>

      {/* Address search — Google Places autocomplete (only when configured) */}
      {isPlacesConfigured ? (
        <div className="relative">
          <Input
            label="Search your address"
            placeholder="Start typing your street, area or society…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            hint={searching ? "Searching…" : "Pick a match to autofill the fields below"}
          />
          {suggestions.length > 0 ? (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-ng-line bg-ng-paper shadow-[0_16px_40px_rgba(20,51,31,0.18)]">
              {suggestions.map((s) => (
                <li key={s.placeId}>
                  <button
                    type="button"
                    onClick={() => void pickSuggestion(s)}
                    className="flex w-full cursor-pointer items-start gap-2.5 px-4 py-3 text-left text-[14px] text-ng-ink transition-colors hover:bg-ng-sage/40"
                  >
                    <Icon name="map-point-linear" size={16} className="mt-0.5 shrink-0 text-ng-forest" />
                    {s.text}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Type selector */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] font-medium text-ng-ink-muted mb-1">
          Address type
        </legend>
        <div className="flex gap-2">
          {TYPE_OPTIONS.map((opt) => {
            const active = form.type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => set("type", opt.value)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 h-10 text-[14px] font-medium border transition-all",
                  active
                    ? "bg-ng-forest text-ng-paper border-ng-forest"
                    : "bg-ng-paper text-ng-ink-muted border-ng-line hover:border-ng-leaf",
                )}
              >
                <Icon name={opt.icon} size={16} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Custom label — only for "Other" */}
      {form.type === "other" ? (
        <Input
          label="Label this address"
          placeholder="e.g. Mom's place, Gym, Weekend home"
          value={form.label}
          onChange={(e) => set("label", e.target.value)}
          error={errors.label}
        />
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4">
        <Input
          label="Full name"
          placeholder="Recipient's name"
          value={form.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          error={errors.fullName}
        />
        <Input
          label="Phone number"
          placeholder="+91 98765 43210"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          error={errors.phone}
        />
      </div>

      <Input
        label="Building / Floor / Flat"
        placeholder="Flat 4B, Banyan Grove Apartments"
        value={form.line1}
        onChange={(e) => set("line1", e.target.value)}
        error={errors.line1}
      />

      <Input
        label="Road / Street"
        placeholder="Road no. 12, Madhapur"
        value={form.line2}
        onChange={(e) => set("line2", e.target.value)}
      />

      <Input
        label="Area / Locality"
        placeholder="Mathrusree Nagar, Hafeezpet"
        value={form.area}
        onChange={(e) => set("area", e.target.value)}
      />

      <Input
        label="Landmark (optional)"
        placeholder="Opposite Jyoti Nivas College"
        value={form.landmark}
        onChange={(e) => set("landmark", e.target.value)}
      />

      <div className="grid sm:grid-cols-2 gap-4">
        <Input
          label="City"
          placeholder="Hyderabad"
          value={form.city}
          onChange={(e) => set("city", e.target.value)}
          error={errors.city}
        />
        <Input
          label="Pincode"
          placeholder="500081"
          inputMode="numeric"
          maxLength={6}
          value={form.pincode}
          onChange={(e) =>
            set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          error={errors.pincode}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Input
          label="Region / District (optional)"
          placeholder="Hyderabad"
          value={form.region}
          onChange={(e) => set("region", e.target.value)}
        />
        <Input
          label="State"
          placeholder="Telangana"
          value={form.state}
          onChange={(e) => set("state", e.target.value)}
          error={errors.state}
        />
      </div>

      <Input
        label="Country"
        value={form.country}
        disabled
        hint="We currently deliver within India only."
      />

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" variant="primary">
          {initial ? "Save changes" : "Save address"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
