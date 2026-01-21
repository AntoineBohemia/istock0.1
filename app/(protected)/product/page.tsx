import { generateMeta } from "@/lib/utils";

import ProductHeader from "./product-header";
import ProductList from "./product-list";
import ProductStats from "./product-stats";

export async function generateMetadata() {
  return generateMeta({
    title: "Stock des produits",
    description:
      "Suivi du stock des peintures et revêtements. Visualisez, filtrez et gérez vos produits en temps réel.",
    canonical: "/product",
  });
}

export default function Page() {
  return (
    <div className="space-y-4">
      <ProductHeader />
      <ProductStats />
      <div className="pt-4">
        <ProductList />
      </div>
    </div>
  );
}
