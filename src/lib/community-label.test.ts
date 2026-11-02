import { describe, expect, it } from "vitest";
import {
  addressNamesCommunity,
  communityKey,
  communityName,
  matchesCommunity,
  snapshotAddressText,
  withPincode,
} from "@/lib/community-label";

const PLACES = "SAS Crown, Golden Mile Road, Kokapet, Hyderabad, Telangana, India";

describe("addressNamesCommunity", () => {
  it("finds a picked community in the address a customer typed", () => {
    expect(addressNamesCommunity([PLACES], "Flat 402, Tower B, SAS Crown, Kokapet")).toBe(true);
  });

  it("ignores case and punctuation", () => {
    expect(addressNamesCommunity(["SAS Crown"], "402/B sas-crown, kokapet")).toBe(true);
    expect(addressNamesCommunity(["Lansum's Elena"], "Villa 9, Lansums Elena")).toBe(true);
  });

  it("matches on whole words only", () => {
    expect(addressNamesCommunity(["Green Park"], "12 Evergreen Park Road")).toBe(false);
    expect(addressNamesCommunity(["Park"], "Parkview Residency")).toBe(false);
  });

  it("copes with a name that would break a regular expression", () => {
    expect(addressNamesCommunity(["Sri Sai (Phase 2"], "Plot 4, Sri Sai Phase 2, Miyapur")).toBe(true);
  });

  it("finds any of several communities", () => {
    expect(addressNamesCommunity(["My Home Avatar", "SAS Crown"], "SAS Crown, Kokapet")).toBe(true);
  });

  it("is false for no address, and never matches on a blank name", () => {
    expect(addressNamesCommunity([PLACES], "")).toBe(false);
    expect(addressNamesCommunity([PLACES], null)).toBe(false);
    expect(addressNamesCommunity([" , "], "SAS Crown")).toBe(false);
    expect(addressNamesCommunity([" , "], "   ")).toBe(false);
  });

  it("works for names outside the Latin alphabet, vowel signs included", () => {
    expect(addressNamesCommunity(["గ్రీన్ పార్క్"], "ఫ్లాట్ 4, గ్రీన్ పార్క్, మియాపూర్")).toBe(true);
  });
});

describe("snapshotAddressText", () => {
  it("joins the address lines of a real checkout snapshot", () => {
    expect(
      snapshotAddressText({
        line1: "Flat 402, SAS Crown",
        line2: "Golden Mile Road, Kokapet",
        landmark: "Near the gate",
        city: "Hyderabad",
        pincode: "500075",
      }),
    ).toBe("Flat 402, SAS Crown, Golden Mile Road, Kokapet, Near the gate");
  });

  it("leaves out the recipient, so a name can't qualify for a community", () => {
    const text = snapshotAddressText({
      fullName: "Green Park",
      label: "Green Park",
      phone: "+919876543210",
      line1: "12 MG Road",
    });

    expect(text).toBe("12 MG Road");
    expect(addressNamesCommunity(["Green Park"], text)).toBe(false);
  });

  it("reads the older key spellings", () => {
    expect(snapshotAddressText({ buildingFloorFlat: "A-1", areaLandmark: "SAS Crown" })).toBe("A-1, SAS Crown");
  });

  it("is empty for no snapshot, and skips anything that isn't text", () => {
    expect(snapshotAddressText(null)).toBe("");
    expect(snapshotAddressText({ line1: 42, line2: "  " })).toBe("");
  });
});

describe("withPincode", () => {
  it("adds to what's there, and de-dupes", () => {
    expect(withPincode("", "500075")).toBe("500075");
    expect(withPincode("500032, 500081", "500075")).toBe("500032, 500081, 500075");
    expect(withPincode("500075", "500075")).toBe("500075");
  });
});

describe("communityKey", () => {
  it("reduces a full Places address to the place itself", () => {
    expect(communityKey(PLACES)).toBe("sas crown");
  });

  it("ignores case and stray spacing", () => {
    expect(communityKey("  My  Home   Avatar ")).toBe("my home avatar");
  });

  it("skips an empty leading segment", () => {
    expect(communityKey(", SAS Crown")).toBe("sas crown");
  });

  it("is empty for nothing", () => {
    expect(communityKey(" , ")).toBe("");
  });
});

describe("communityName", () => {
  it("keeps the place's own casing for the delivery list", () => {
    expect(communityName(PLACES)).toBe("SAS Crown");
  });
});

describe("matchesCommunity", () => {
  it("matches a picked address against the short delivery-list name", () => {
    expect(matchesCommunity([PLACES], ["SAS Crown"])).toBe(true);
  });

  it("matches in the other direction too", () => {
    expect(matchesCommunity(["sas crown"], [PLACES])).toBe(true);
  });

  it("does not match a different community on the same road", () => {
    expect(matchesCommunity([PLACES], ["My Home Avatar, Golden Mile Road, Kokapet"])).toBe(false);
  });

  it("never matches on blanks", () => {
    expect(matchesCommunity([" , "], [" , ", ""])).toBe(false);
    expect(matchesCommunity([], ["SAS Crown"])).toBe(false);
  });
});
