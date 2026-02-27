import { icons } from "lucide-react";
import { Package } from "lucide-react";
import Image from "next/image";

const SIZE_MAP = {
  sm: { container: "size-8", icon: "size-4", image: 32 },
  md: { container: "size-10", icon: "size-5", image: 40 },
  lg: { container: "size-12", icon: "size-6", image: 48 },
  xl: { container: "size-full aspect-square", icon: "size-16", image: 300 },
} as const;

interface ProductIconDisplayProps {
  iconName?: string | null;
  iconColor?: string | null;
  imageUrl?: string | null;
  size?: keyof typeof SIZE_MAP;
  className?: string;
}

export default function ProductIconDisplay({
  iconName,
  iconColor,
  imageUrl,
  size = "md",
  className,
}: ProductIconDisplayProps) {
  const s = SIZE_MAP[size];

  // Priority 1: Lucide icon
  if (iconName) {
    const LucideIcon = (icons as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>)[iconName];
    if (LucideIcon) {
      return (
        <div
          className={`flex ${s.container} items-center justify-center rounded-lg border bg-muted ${className ?? ""}`}
        >
          <LucideIcon className={s.icon} style={{ color: iconColor ?? undefined }} />
        </div>
      );
    }
  }

  // Priority 2: Image
  if (imageUrl) {
    if (size === "xl") {
      return (
        <div className={`relative ${s.container} overflow-hidden rounded-lg border ${className ?? ""}`}>
          <Image
            src={imageUrl}
            fill
            className="object-cover"
            alt="Produit"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        </div>
      );
    }
    return (
      <div className={`flex ${s.container} items-center justify-center overflow-hidden rounded-lg border bg-muted ${className ?? ""}`}>
        <Image
          src={imageUrl}
          width={s.image}
          height={s.image}
          className="size-full rounded-lg object-cover"
          alt="Produit"
        />
      </div>
    );
  }

  // Priority 3: Fallback
  return (
    <div
      className={`flex ${s.container} items-center justify-center rounded-lg border bg-muted ${className ?? ""}`}
    >
      <Package className={`${s.icon} text-muted-foreground`} />
    </div>
  );
}
