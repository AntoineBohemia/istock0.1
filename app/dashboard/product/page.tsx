import { promises as fs } from "fs";
import path from "path";
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

export async function generateMetadata() {
  return generateMeta({
    title: "Stock des produits",
    description:
      "Suivi du stock des peintures et revêtements. Visualisez, filtrez et gérez vos produits en temps réel. Construit avec shadcn/ui, Tailwind CSS et Next.js.",
    canonical: "/pages/stock-produits",
  });
}

async function getProducts() {
  const data = await fs.readFile(
    path.join(process.cwd(), "app/dashboard/product/product-data.json")
  );
  return JSON.parse(data.toString());
}

export default async function Page() {
  const products = await getProducts();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Stock produits</h1>
        <Button asChild>
          <Link href="/dashboard/product/create">
            <PlusCircle /> Ajouter un produit
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Stock global</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">
              85,000
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <span className="text-green-600">+5.02</span>
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Valeur totale du stock</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">
              €30,230
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <span className="text-green-600">+20.1%</span>
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Entrées</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">
              €4,530
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <span className="text-green-600">+3.1%</span>
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Sorties</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">
              €2,230
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <span className="text-red-600">-3.58%</span>
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
      </div>
      <div className="pt-4">
        <ProductList data={products} />
      </div>
    </div>
  );
}
