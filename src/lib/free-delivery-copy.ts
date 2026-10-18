/**
 * Copy for the free-delivery claim, shared by server and client components.
 *
 * A threshold of ₹0 means every order ships free. Built as "over ₹0" it read
 * like a typo on the shop hero, the cart and the assurance strip.
 */
export function freeDeliveryOver(rupees: number): string {
  return rupees > 0 ? `over ₹${rupees.toLocaleString("en-IN")}` : "on every order";
}
