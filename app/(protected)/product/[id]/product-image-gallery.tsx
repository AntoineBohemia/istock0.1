"use client";

import React, { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Swiper as SwiperClass } from "swiper/types";
import { FreeMode, Navigation, Thumbs } from "swiper/modules";
import Image from "next/image";
import { ImageIcon } from "lucide-react";

import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/navigation";
import "swiper/css/thumbs";

import { Card, CardContent } from "@/components/ui/card";

interface ProductImageGalleryProps {
  imageUrl?: string | null;
}

export default function ProductImageGallery({
  imageUrl,
}: ProductImageGalleryProps) {
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperClass | null>(null);

  const images = imageUrl ? [imageUrl] : [];
  // Fallback when no image
  if (images.length === 0) {
    return (
      <div className="sticky top-20">
        <Card>
          <CardContent className="flex aspect-square items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIcon className="size-16 opacity-30" />
              <span className="text-sm">Pas d&apos;image</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="sticky top-20 space-y-4">
      <Card>
        <CardContent>
          <Swiper
            style={
              {
                "--swiper-navigation-color": "var(--primary)",
                "--swiper-pagination-color": "var(--primary)",
              } as React.CSSProperties
            }
            loop={true}
            spaceBetween={10}
            navigation={true}
            thumbs={{ swiper: thumbsSwiper }}
            modules={[FreeMode, Navigation, Thumbs]}
            className="mySwiper2"
          >
            {images.map((image, key) => (
              <SwiperSlide key={key}>
                <Image
                  src={image}
                  className="aspect-3/2 w-full rounded-lg object-contain lg:aspect-square"
                  width={300}
                  height={300}
                  alt="Image du produit"
                  unoptimized
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </CardContent>
      </Card>
      <Swiper
        onSwiper={setThumbsSwiper}
        loop={true}
        spaceBetween={10}
        slidesPerView={4}
        freeMode={true}
        watchSlidesProgress={true}
        modules={[FreeMode, Navigation, Thumbs]}
        className="mySwiper mt-2"
      >
        {images.map((image, key) => (
          <SwiperSlide key={key} className="group">
            <figure className="group-[.swiper-slide-thumb-active]:border-primary overflow-hidden rounded-lg border opacity-70 group-[.swiper-slide-thumb-active]:opacity-100!">
              <Image
                className="aspect-square w-full object-contain"
                src={image}
                width={300}
                height={300}
                alt="Image du produit"
                unoptimized
              />
            </figure>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
