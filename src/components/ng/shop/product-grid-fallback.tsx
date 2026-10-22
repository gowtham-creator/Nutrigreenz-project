import type { ComponentProps } from "react";
import { ProductCard } from "@/components/ng/product-card";

type Product = ComponentProps<typeof ProductCard>["product"];

/**
 * Server-rendered product grid shown while the interactive listing (which reads
 * ?q= on the client) loads. It puts every product card and its link in the HTML,
 * so search engines and AI crawlers that do not run JavaScript can reach them.
 */
export function ProductGridFallback({ products }: { products: readonly Product[] }) {
  return (
    <div className="mx-auto max-w-7xl px-5 py-10 md:px-8">
      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
