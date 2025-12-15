"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface ProductImageGalleryProps {
  imageUrl?: string | null;
}

export default function ProductImageGallery({
  imageUrl,
}: ProductImageGalleryProps) {
  if (!imageUrl) {
    return (
      <Card>
        <CardContent className="flex aspect-square items-center justify-center p-6">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="size-16 opacity-30" />
            <span className="text-sm">Pas d&apos;image</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <figure className="relative aspect-square w-full">
          <Image
            src={imageUrl}
            fill
            className="object-cover"
            alt="Image du produit"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        </figure>
      </CardContent>
    </Card>
  );
}
