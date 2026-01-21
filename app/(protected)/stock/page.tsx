"use client";

import { useEffect, useState } from "react";
import { useQueryState } from "nuqs";
import { Package, Scan, ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import QuickStockMovementModal from "@/components/quick-stock-movement-modal";

export default function StockPage() {
  const [productParam, setProductParam] = useQueryState("product");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Auto-open modal when product param is present
  useEffect(() => {
    if (productParam) {
      setIsModalOpen(true);
    }
  }, [productParam]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Clear the product param when modal is closed
    setProductParam(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mouvement de stock</h1>
        <p className="text-muted-foreground">
          Scannez un QR code ou sélectionnez un produit pour enregistrer un mouvement
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="size-5" />
              Scanner un produit
            </CardTitle>
            <CardDescription>
              Utilisez l'appareil photo pour scanner un QR code produit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Le QR code se trouve sur l'étiquette du produit ou sur sa fiche produit.
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/scan">
                Ouvrir le scanner
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-5" />
              Sélectionner un produit
            </CardTitle>
            <CardDescription>
              Recherchez un produit dans votre catalogue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Accédez à la liste des produits et cliquez sur "Restocker" pour enregistrer un mouvement.
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/product">
                Voir les produits
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <QuickStockMovementModal
        open={isModalOpen}
        onClose={handleCloseModal}
        productId={productParam}
      />
    </div>
  );
}
