import { cn } from "@/lib/utils";

/**
 * Brand cart glyph (client-provided Icons8 mark). A raster PNG can't recolour via
 * `currentColor`, so we ship a dark + a white version and pick per surface:
 * `tone="white"` on the dark "Add to cart" button, `tone="dark"` on light bars.
 */
export function CartIcon({
  size = 18,
  tone = "dark",
  className,
}: {
  size?: number;
  tone?: "dark" | "white";
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tone === "white" ? "/icons/cart-white.png" : "/icons/cart-dark.png"}
      alt=""
      width={size}
      height={size}
      aria-hidden
      className={cn("inline-block shrink-0 object-contain", className)}
    />
  );
}
