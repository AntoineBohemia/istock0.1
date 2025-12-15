import { generateMeta } from "@/lib/utils";
import Link from "next/link";
import { PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ProductList from "./product-list";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  return generateMeta({
    title: "Stock des produits",
    description:
      "Suivi du stock des peintures et revêtements. Visualisez, filtrez et gérez vos produits en temps réel.",
    canonical: "/product",
  });
}

async function getProductsStats() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("stock_current, stock_min, price");

  if (!products) return { total: 0, lowStock: 0, outOfStock: 0, totalValue: 0 };

  const total = products.reduce((sum, p) => sum + p.stock_current, 0);
  const lowStock = products.filter(
    (p) => p.stock_current <= p.stock_min && p.stock_current > 0
  ).length;
  const outOfStock = products.filter((p) => p.stock_current === 0).length;
  const totalValue = products.reduce(
    (sum, p) => sum + (p.price || 0) * p.stock_current,
    0
  );

  return { total, lowStock, outOfStock, totalValue };
}

export default async function Page() {
  const stats = await getProductsStats();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Stock produits</h1>
        <Button asChild>
          <Link href="/product/create">
            <PlusCircle /> Ajouter un produit
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Stock global</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">
              {stats.total.toLocaleString("fr-FR")}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">unités</Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Valeur totale du stock</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">
              {stats.totalValue.toLocaleString("fr-FR", {
                style: "currency",
                currency: "EUR",
              })}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Stock faible</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">
              {stats.lowStock}
            </CardTitle>
            <CardAction>
              {stats.lowStock > 0 ? (
                <Badge variant="warning">Attention</Badge>
              ) : (
                <Badge variant="success">OK</Badge>
              )}
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Rupture de stock</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">
              {stats.outOfStock}
            </CardTitle>
            <CardAction>
              {stats.outOfStock > 0 ? (
                <Badge variant="destructive">Critique</Badge>
              ) : (
                <Badge variant="success">OK</Badge>
              )}
            </CardAction>
          </CardHeader>
        </Card>
      </div>
      <div className="pt-4">
        <ProductList />
      </div>
    </div>
  );
}
