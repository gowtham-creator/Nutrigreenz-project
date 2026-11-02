// @vitest-environment jsdom
/**
 * The two targeting controls in the coupon forms, and the picker they build on.
 */
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  autocompleteAddress: vi.fn(),
  fetchPlaceAddress: vi.fn(),
}));

vi.mock("@/lib/places-client", () => ({
  autocompleteAddress: m.autocompleteAddress,
  fetchPlaceAddress: m.fetchPlaceAddress,
  isPlacesConfigured: true,
  newSessionToken: () => "session",
}));
vi.mock("@/components/ui/icon", () => ({ Icon: () => null }));
vi.mock("@/components/ui/ui-icon", () => ({ UiIcon: () => null }));

import { CommunityPicker } from "@/components/ng/admin/community-picker";
import { CouponCommunityField } from "@/components/ng/admin/super/coupon-community-field";
import { CouponCustomerPhones } from "@/components/ng/admin/super/coupon-customer-phones";

afterEach(cleanup);

describe("CouponCustomerPhones", () => {
  function Harness({ initial = [] as string[] }) {
    const [value, setValue] = useState(initial);
    return (
      <>
        <CouponCustomerPhones value={value} onChange={setValue} />
        <output data-testid="value">{JSON.stringify(value)}</output>
      </>
    );
  }

  const boxes = () => screen.getAllByRole("textbox") as HTMLInputElement[];
  const value = () => JSON.parse(screen.getByTestId("value").textContent ?? "[]") as string[];
  const plus = () => screen.getByRole("button", { name: "Add another mobile number" });

  it("starts with one empty box", () => {
    render(<Harness />);

    expect(boxes()).toHaveLength(1);
  });

  it("adds a box with the plus button, beside the last box only", () => {
    render(<Harness initial={["9876543210"]} />);

    fireEvent.click(plus());

    expect(boxes()).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Add another mobile number" })).toHaveLength(1);
  });

  it("moves focus to the new box", async () => {
    render(<Harness initial={["9876543210"]} />);

    fireEvent.click(plus());

    await waitFor(() => expect(document.activeElement).toBe(boxes()[1]));
  });

  it("removes a row", () => {
    render(<Harness initial={["9876543210", "9876543211"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove customer mobile number 1" }));

    expect(value()).toEqual(["9876543211"]);
  });

  it("empties the last row rather than leaving no box at all", () => {
    render(<Harness initial={["9876543210"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove customer mobile number 1" }));

    expect(boxes()).toHaveLength(1);
    expect(boxes()[0].value).toBe("");
  });

  it("shows an inline error on a bad number once the operator has left the box", () => {
    render(<Harness initial={[""]} />);

    fireEvent.focus(boxes()[0]);
    fireEvent.change(boxes()[0], { target: { value: "12345" } });
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.blur(boxes()[0]);
    expect(screen.getByRole("alert").textContent).toBe("Enter a valid mobile number");
    expect(boxes()[0].getAttribute("aria-invalid")).toBe("true");
  });

  it("flags a repeated number", () => {
    render(<Harness initial={["+91 98765 43210", "9876543210"]} />);

    expect(screen.getByRole("alert").textContent).toBe("This number is already on the list");
  });

  it("treats Enter as the plus button in the last box", () => {
    render(<Harness initial={["9876543210"]} />);

    fireEvent.keyDown(boxes()[0], { key: "Enter" });

    expect(boxes()).toHaveLength(2);
  });
});

describe("CouponCommunityField", () => {
  const PLACE = { placeId: "p1", text: "SAS Crown, Golden Mile Road, Kokapet, Hyderabad" };

  function Harness({ pincodes: initial = "" }: { pincodes?: string }) {
    const [communities, setCommunities] = useState<string[]>([]);
    const [pincodes, setPincodes] = useState(initial);
    return (
      <>
        <CouponCommunityField
          communities={communities}
          onCommunities={setCommunities}
          pincodes={pincodes}
          onPincodes={(update) => setPincodes(update)}
        />
        <output data-testid="communities">{JSON.stringify(communities)}</output>
      </>
    );
  }

  const search = () => screen.getByPlaceholderText(/Search a community/);
  const pins = () => screen.getByLabelText("Community pincodes") as HTMLInputElement;

  async function pickFromMap() {
    fireEvent.change(search(), { target: { value: "SAS" } });
    fireEvent.click(await screen.findByRole("button", { name: PLACE.text }));
  }

  beforeEach(() => {
    m.autocompleteAddress.mockResolvedValue([PLACE]);
  });

  it("adds a picked community's pincode, and keeps the address whole", async () => {
    m.fetchPlaceAddress.mockResolvedValue({ pincode: "500075", area: "Kokapet" });
    render(<Harness />);

    await pickFromMap();

    await waitFor(() => expect(pins().value).toBe("500075"));
    expect(screen.getByTestId("communities").textContent).toContain(PLACE.text);
  });

  it("adds to pincodes already listed, without repeating one", async () => {
    m.fetchPlaceAddress.mockResolvedValue({ pincode: "500075" });
    render(<Harness pincodes="500032, 500075" />);

    await pickFromMap();

    await waitFor(() => expect(m.fetchPlaceAddress).toHaveBeenCalled());
    expect(pins().value).toBe("500032, 500075");
  });

  it("adds no pincode for a typed community, and makes no billed Details call", async () => {
    m.autocompleteAddress.mockResolvedValue([]);
    render(<Harness />);

    fireEvent.change(search(), { target: { value: "Aparna Sarovar" } });
    fireEvent.keyDown(search(), { key: "Enter" });

    await waitFor(() =>
      expect(screen.getByTestId("communities").textContent).toContain("Aparna Sarovar"),
    );
    expect(pins().value).toBe("");
    expect(m.fetchPlaceAddress).not.toHaveBeenCalled();
  });

  it("warns that a typed community is shut out once other pincodes are listed", async () => {
    m.autocompleteAddress.mockResolvedValue([]);
    render(<Harness pincodes="500075" />);

    fireEvent.change(search(), { target: { value: "Aparna Sarovar" } });
    fireEvent.keyDown(search(), { key: "Enter" });

    expect((await screen.findByText("Aparna Sarovar", { selector: "strong" })).textContent).toBe(
      "Aparna Sarovar",
    );
  });

  it("warns when Google has no pincode, since nothing then fences the name", async () => {
    m.fetchPlaceAddress.mockResolvedValue({ pincode: "" });
    render(<Harness />);

    await pickFromMap();

    expect(await screen.findByText(/Google has no pincode/)).toBeTruthy();
  });

  it("lets the operator edit the pincodes by hand", () => {
    render(<Harness />);

    fireEvent.change(pins(), { target: { value: "500019" } });

    expect(pins().value).toBe("500019");
  });

  it("offers no way to add a delivery area", () => {
    render(<Harness />);

    expect(screen.queryByRole("button", { name: /delivery areas/i })).toBeNull();
  });
});

describe("CommunityPicker without onPick, as the captain modal uses it", () => {
  it("makes no Place Details call, so its billing is unchanged", async () => {
    m.autocompleteAddress.mockResolvedValue([{ placeId: "p1", text: "SAS Crown, Kokapet" }]);
    const onChange = vi.fn();
    render(<CommunityPicker value={[]} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText(/Search a community/), { target: { value: "SAS" } });
    fireEvent.click(await screen.findByRole("button", { name: "SAS Crown, Kokapet" }));

    expect(onChange).toHaveBeenCalledWith(["SAS Crown, Kokapet"]);
    expect(m.fetchPlaceAddress).not.toHaveBeenCalled();
  });
});
