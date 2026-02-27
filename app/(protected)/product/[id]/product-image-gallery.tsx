"use client";

import ProductIconDisplay from "@/components/product-icon-display";
import { Card, CardContent } from "@/components/ui/card";

interface ProductImageGalleryProps {
  imageUrl?: string | null;
  iconName?: string | null;
  iconColor?: string | null;
}

export default function ProductImageGallery({
  imageUrl,
  iconName,
  iconColor,
}: ProductImageGalleryProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center justify-center p-0">
        <ProductIconDisplay
          iconName={iconName}
          iconColor={iconColor}
          imageUrl={imageUrl}
          size="xl"
        />
      </CardContent>
    </Card>
  );
}
