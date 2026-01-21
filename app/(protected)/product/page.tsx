import { generateMeta } from "@/lib/utils";
import Link from "next/link";
import { Package, PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
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
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Stock produits</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/stock">
              <Package /> Mouvement de stock
            </Link>
          </Button>
          <Button asChild>
            <Link href="/product/create">
              <PlusCircle /> Ajouter un produit
            </Link>
          </Button>
        </div>
      </div>
      <ProductStats />
      <div className="pt-4">
        <ProductList />
      </div>
    </div>
  );
}
