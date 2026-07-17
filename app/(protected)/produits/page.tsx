import { generateMeta } from "@/lib/utils";

import ProductList from "./product-list";

export async function generateMetadata() {
  return generateMeta({
    title: "Stock des produits",
    description:
      "Suivi du stock des peintures et revêtements. Visualisez, filtrez et gérez vos produits en temps réel.",
    canonical: "/produits",
  });
}

export default function Page() {
  return <ProductList />;
}
