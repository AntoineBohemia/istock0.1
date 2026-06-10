"use client";

import { ArrowUpFromLine, Users } from "lucide-react";
import Image from "next/image";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ProductIconDisplay from "@/components/product-icon-display";

interface ScannedProduct {
  id: string;
  name: string;
  sku: string | null;
  icon_name: string | null;
  icon_color: string | null;
  image_url: string | null;
  stock_current: number | null;
}

interface ScanActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ScannedProduct | null;
  onStockExit: (productId: string) => void;
  onTechnicianRestock: (productId: string) => void;
}

export default function ScanActionSheet({
  open,
  onOpenChange,
  product,
  onStockExit,
  onTechnicianRestock,
}: ScanActionSheetProps) {
  if (!product) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-[env(safe-area-inset-bottom)]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="sr-only">Action pour {product.name}</DrawerTitle>
          <DrawerDescription className="sr-only">
            Choisissez une action pour ce produit
          </DrawerDescription>
        </DrawerHeader>

        {/* Product info */}
        <div className="flex items-center gap-3 mx-4 mb-4 rounded-lg border bg-muted/50 p-3">
          <div className="flex size-12 items-center justify-center rounded-lg border bg-background shrink-0 overflow-hidden">
            {product.image_url ? (
              <Image
                src={product.image_url}
                width={48}
                height={48}
                alt={product.name}
                className="size-full object-cover"
              />
            ) : (
              <ProductIconDisplay
                iconName={product.icon_name}
                iconColor={product.icon_color}
                imageUrl={null}
                size="sm"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{product.name}</p>
            {product.sku && (
              <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
            )}
          </div>
          <Badge variant="outline" className="shrink-0 tabular-nums">
            Stock: {product.stock_current ?? 0}
          </Badge>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 mx-4 mb-4">
          <Button
            size="lg"
            className="w-full min-h-14 justify-start gap-3 bg-rose-600 hover:bg-rose-700 text-white"
            onClick={() => {
              onOpenChange(false);
              onStockExit(product.id);
            }}
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-white/20">
              <ArrowUpFromLine className="size-5" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">Sortie de stock</p>
              <p className="text-xs opacity-80">Retirer du stock rapidement</p>
            </div>
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-full min-h-14 justify-start gap-3"
            onClick={() => {
              onOpenChange(false);
              onTechnicianRestock(product.id);
            }}
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
              <Users className="size-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">Restocker technicien</p>
              <p className="text-xs text-muted-foreground">Attribuer à un technicien</p>
            </div>
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
