// @vitest-environment jsdom
/**
 * The two coupon forms, driven as an operator would, down to the request sent.
 * The API is mocked at `fetch`.
 */
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  fetchAdminCoupons: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: m.success, error: m.error } }));
vi.mock("@/lib/admin-coupons-client", () => ({
  fetchAdminCoupons: m.fetchAdminCoupons,
  invalidateAdminCoupons: vi.fn(),
}));
vi.mock("@/lib/places-client", () => ({
  autocompleteAddress: vi.fn(async () => []),
  fetchPlaceAddress: vi.fn(),
  isPlacesConfigured: false,
  newSessionToken: () => "session",
}));
vi.mock("@/components/ui/icon", () => ({ Icon: () => null }));
vi.mock("@/components/ui/ui-icon", () => ({ UiIcon: () => null }));
vi.mock("@/components/ui/app-icon", () => ({ AppIcon: () => null }));
vi.mock("@/components/ng/admin/admin-shell", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Pill: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/ng/admin/super/command-center", () => ({
  SectionHeader: ({ action }: { action?: ReactNode }) => <div>{action}</div>,
}));
vi.mock("@/components/ng/admin/product-picker", () => ({ ProductPicker: () => null }));

import { CouponCampaignBuilder } from "@/components/ng/admin/super/coupon-campaign-builder";
import { LiveCouponsPanel } from "@/components/ng/admin/super/live-coupons-panel";

const PLACE = "SAS Crown, Golden Mile Road, Kokapet, Hyderabad, Telangana, India";

const COUPON = {
  id: "c1",
  code: "SOCIETY10",
  kind: "percent",
  value: 10,
  minOrderPaise: 0,
  capPaise: null,
  active: true,
  usageLimit: null,
  perCustomerLimit: 1,
  usedCount: 0,
  requiresVerifiedPhone: false,
  startsAt: "2020-01-31T18:30:00.000Z",
  endsAt: "2099-11-30T18:29:59.999Z",
  pincodes: null,
  communities: null,
  productIds: null,
  customerPhones: null,
  stackLoyalty: true,
  description: null,
};

const fetchMock = vi.fn();
const requests = () =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method && init.method !== "GET")
    .map(([url, init]) => ({
      url: String(url),
      method: init.method as string,
      body: JSON.parse(init.body as string) as Record<string, unknown>,
    }));

function respondWith(saved: Record<string, unknown> = COUPON) {
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
    Response.json(init?.method ? { ok: true, coupon: saved } : { items: [] }),
  );
}

const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const mode = (name: string) => fireEvent.click(screen.getByRole("radio", { name }));

beforeEach(() => {
  // jsdom has no layout, so it leaves this out. The builder calls it on Edit.
  Element.prototype.scrollIntoView = () => {};
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  respondWith();
  m.fetchAdminCoupons.mockResolvedValue({ coupons: [] });
});

afterEach(cleanup);

async function openBuilder(coupons: unknown[] = []) {
  m.fetchAdminCoupons.mockResolvedValue({ coupons });
  render(<CouponCampaignBuilder />);
  await screen.findByText(/live · /);
}

async function editFirst(code: string) {
  await screen.findByRole("button", { name: `Edit ${code}` });
  click(`Edit ${code}`);
}

describe("campaign builder — dates", () => {
  it("won't create a coupon without dates", async () => {
    await openBuilder();
    type("Campaign code", "FRESH50");

    click("Create campaign");

    expect(m.error).toHaveBeenCalledWith("Choose a start date");
    expect(requests()).toEqual([]);
  });

  it("won't create one that ends before it starts", async () => {
    await openBuilder();
    type("Campaign code", "FRESH50");
    type("Start date", "2030-11-10");
    type("End date", "2030-11-09");

    click("Create campaign");

    expect(m.error).toHaveBeenCalledWith("The end date can't be before the start date");
    expect(requests()).toEqual([]);
  });

  it("has no perpetual option left", async () => {
    await openBuilder();

    expect(screen.queryByText(/perpetual/i)).toBeNull();
    expect(screen.queryByText(/Expiry date/)).toBeNull();
    expect(screen.queryByText(/not connected yet/)).toBeNull();
  });

  it("sends the days, and doesn't claim a future code is live", async () => {
    respondWith({ ...COUPON, startsAt: "2030-11-04T18:30:00.000Z", endsAt: "2030-11-30T18:29:59.999Z" });
    await openBuilder();
    type("Campaign code", "FRESH50");
    type("Start date", "2030-11-05");
    type("End date", "2030-11-30");

    click("Create campaign");

    await waitFor(() => expect(m.success).toHaveBeenCalled());
    expect(requests()[0].body).toMatchObject({ startsAt: "2030-11-05", endsAt: "2030-11-30" });
    const [title, options] = m.success.mock.calls[0] as [string, { description: string }];
    expect(title).toBe("FRESH50 is scheduled");
    expect(options.description).toContain("opens at checkout on 5 Nov");
  });

  it("shows the end date in the message preview", async () => {
    await openBuilder();
    type("End date", "2030-11-30");

    expect(screen.getByText(/Valid till 30 Nov/)).toBeTruthy();
  });

  it("reads a stored start back as the IST day, not the day before", async () => {
    await openBuilder([{ ...COUPON, startsAt: "2030-11-04T18:30:00.000Z" }]);
    await editFirst("SOCIETY10");

    expect(field("Start date").value).toBe("2030-11-05");
  });

  it("lets an older coupon with no dates be saved without any", async () => {
    await openBuilder([{ ...COUPON, startsAt: null, endsAt: null }]);
    await editFirst("SOCIETY10");

    click("Save changes");

    await waitFor(() => expect(requests()).toHaveLength(1));
    expect(requests()[0].method).toBe("PATCH");
    expect(requests()[0].body).toMatchObject({ startsAt: null, endsAt: null });
  });
});

describe("campaign builder — list", () => {
  it("shows each coupon's window and standing", async () => {
    await openBuilder([
      { ...COUPON, id: "a", code: "NOWLIVE" },
      { ...COUPON, id: "b", code: "LATER", startsAt: "2098-11-01T00:00:00.000Z" },
      { ...COUPON, id: "c", code: "OVER", endsAt: "2020-02-29T18:29:59.999Z" },
      { ...COUPON, id: "d", code: "OFF", active: false },
    ]);

    await screen.findByRole("button", { name: "Edit OVER" });
    expect(screen.getByText("1 Feb – 29 Feb")).toBeTruthy();
    expect(screen.getAllByText("Live")).toHaveLength(1);
    expect(screen.getByText("Scheduled")).toBeTruthy();
    expect(screen.getByText("Ended")).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();
    // The header counts what is live, not every row.
    expect(screen.getByText(/1 live · 0 redeemed/)).toBeTruthy();
  });

  it("no longer labels a first-order coupon as specific customers", async () => {
    await openBuilder([{ ...COUPON, requiresVerifiedPhone: true }]);

    await screen.findByRole("button", { name: "Edit SOCIETY10" });
    // Once as the radio, and once more on the coupon's row.
    expect(screen.getAllByText("All customers")).toHaveLength(2);
    expect(screen.getAllByText("Specific customers")).toHaveLength(1);
  });
});

describe("campaign builder — specific customers", () => {
  async function fillIndividual() {
    await openBuilder();
    type("Campaign code", "VIP20");
    type("Start date", "2030-11-05");
    type("End date", "2030-11-30");
    mode("Specific customers");
  }

  it("saves the numbers as E.164, so the code stops working for everyone", async () => {
    await fillIndividual();
    type("Customer mobile number 1", "98765 43210");

    click("Create campaign");

    await waitFor(() => expect(requests()).toHaveLength(1));
    expect(requests()[0].body.customerPhones).toEqual(["+919876543210"]);
  });

  it("won't save the mode with no numbers, which would mean anyone", async () => {
    await fillIndividual();

    click("Create campaign");

    expect(m.error).toHaveBeenCalledWith("Add at least one mobile number");
    expect(requests()).toEqual([]);
  });

  it("won't save a bad number", async () => {
    await fillIndividual();
    type("Customer mobile number 1", "12345");

    click("Create campaign");

    expect(m.error).toHaveBeenCalledWith("Fix the highlighted mobile number");
    expect(requests()).toEqual([]);
  });

  it("reloads a saved list and labels it for what it is", async () => {
    await openBuilder([{ ...COUPON, customerPhones: ["+919876543210"] }]);
    await editFirst("SOCIETY10");

    expect(field("Customer mobile number 1").value).toBe("+919876543210");
    // Once as the radio, and once more on the coupon's row.
    expect(screen.getAllByText("Specific customers")).toHaveLength(2);
  });

  it("clears the list when the coupon moves to another mode", async () => {
    await openBuilder([{ ...COUPON, customerPhones: ["+919876543210"] }]);
    await editFirst("SOCIETY10");
    mode("All customers");

    click("Save changes");

    await waitFor(() => expect(requests()).toHaveLength(1));
    expect(requests()[0].body.customerPhones).toBeNull();
  });

  it("refuses to send while the form differs from the saved list", async () => {
    await openBuilder([{ ...COUPON, customerPhones: ["+919876543210"] }]);
    await editFirst("SOCIETY10");
    type("Customer mobile number 1", "9876543211");

    click("Send now");

    expect(m.error).toHaveBeenCalledWith("Save the coupon first", expect.anything());
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("broadcast"))).toBe(false);
  });

  it("refuses to send a code switched to specific customers but not saved", async () => {
    await openBuilder([COUPON]);
    await editFirst("SOCIETY10");
    mode("Specific customers");
    type("Customer mobile number 1", "9876543210");

    click("Send now");

    expect(m.error).toHaveBeenCalledWith("Save the coupon first", expect.anything());
  });
});

describe("campaign builder — gated communities", () => {
  it("won't save the mode with no community, which would mean everywhere", async () => {
    await openBuilder();
    type("Campaign code", "SOCIETY10");
    type("Start date", "2030-11-05");
    type("End date", "2030-11-30");
    mode("Gated community");

    click("Create campaign");

    expect(m.error).toHaveBeenCalledWith("Add at least one community");
    expect(requests()).toEqual([]);
  });

  it("keeps a community and its pincodes through an edit, the address unsplit", async () => {
    await openBuilder([{ ...COUPON, communities: [PLACE], pincodes: ["500075", "500032"] }]);
    await editFirst("SOCIETY10");

    expect(field("Community pincodes").value).toBe("500075, 500032");

    click("Save changes");

    await waitFor(() => expect(requests()).toHaveLength(1));
    expect(requests()[0].body).toMatchObject({
      communities: [PLACE],
      pincodes: ["500075", "500032"],
    });
  });

  it("drops the community when a coupon moves to pincode targeting", async () => {
    await openBuilder([{ ...COUPON, communities: [PLACE], pincodes: ["500075"] }]);
    await editFirst("SOCIETY10");
    mode("Zip-code cluster");

    click("Save changes");

    await waitFor(() => expect(requests()).toHaveLength(1));
    expect(requests()[0].body).toMatchObject({ communities: null, pincodes: ["500075"] });
  });
});

describe("campaign builder — stacking and description", () => {
  it("stacks by default and saves the description", async () => {
    await openBuilder();
    type("Campaign code", "FRESH50");
    type("Start date", "2030-11-05");
    type("End date", "2030-11-30");
    type("Description", "₹50 off your first order");

    click("Create campaign");

    await waitFor(() => expect(requests()).toHaveLength(1));
    expect(requests()[0].body).toMatchObject({
      stackLoyalty: true,
      description: "₹50 off your first order",
    });
  });

  it("reads both back when editing", async () => {
    await openBuilder([{ ...COUPON, stackLoyalty: false, description: "For you" }]);
    await editFirst("SOCIETY10");

    expect(field("Description").value).toBe("For you");
    expect(screen.getByRole("switch", { name: /Stack with loyalty/ }).getAttribute("aria-checked")).toBe("false");
  });
});

describe("live coupons panel", () => {
  async function openPanel() {
    render(<LiveCouponsPanel />);
    await screen.findByText(/No coupons yet/);
    type("Code", "HARVEST10");
    type("Percent", "10");
  }

  it("won't create a coupon without dates", async () => {
    await openPanel();

    click("Add coupon");

    expect(m.error).toHaveBeenCalledWith("Choose a start date.");
    expect(requests()).toEqual([]);
  });

  it("sends the days, and communities as a list so the API can't split an address", async () => {
    await openPanel();
    type("Start date", "2030-11-05");
    type("End date", "2030-11-30");
    fireEvent.change(screen.getByPlaceholderText(/Search a community/), {
      target: { value: "Aparna Sarovar, Nallagandla" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/Search a community/), { key: "Enter" });

    click("Add coupon");

    await waitFor(() => expect(requests()).toHaveLength(1));
    expect(requests()[0].body).toMatchObject({
      startsAt: "2030-11-05",
      endsAt: "2030-11-30",
      communities: ["Aparna Sarovar, Nallagandla"],
    });
  });

  it("explains a refusal from the server", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method
        ? Response.json({ ok: false, error: "dates-invalid" }, { status: 400 })
        : Response.json({}),
    );
    await openPanel();
    type("Start date", "2030-11-05");
    type("End date", "2030-11-30");

    click("Add coupon");

    await waitFor(() => expect(m.error).toHaveBeenCalled());
    expect(m.error.mock.calls[0][0]).toMatch(/end date can't be before/);
  });
});
