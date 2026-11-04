import { describe, expect, it } from "vitest";
import { stateOf } from "./farms-browser";

describe("stateOf (farm region filter)", () => {
  it("takes the state from the end of the region", () => {
    expect(stateOf("Anantapur, Andhra Pradesh")).toBe("Andhra Pradesh");
    expect(stateOf("Nilgiris,Tamil Nadu ")).toBe("Tamil Nadu");
    expect(stateOf("Telangana")).toBe("Telangana");
    expect(stateOf("")).toBe("");
  });
});
