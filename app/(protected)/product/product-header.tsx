import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ProductHeader() {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-tight">Stock produits</h1>
      <Button variant="outline-contrast" asChild>
        <Link href="/product/create">
          <Plus /> Ajouter un produit
        </Link>
      </Button>
    </div>
  );
}
