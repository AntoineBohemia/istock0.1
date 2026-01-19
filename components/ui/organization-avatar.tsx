"use client";

import { cn } from "@/lib/utils";
import {
  Building2,
  Factory,
  Store,
  Warehouse,
  Building,
  Landmark,
  Castle,
  Hotel,
  School,
  Hospital,
  Briefcase,
  Package,
  Boxes,
  Container,
  Truck,
  type LucideIcon,
} from "lucide-react";

// Palette de couleurs agréables pour les avatars
const AVATAR_COLORS = [
  { bg: "bg-blue-500", text: "text-white" },
  { bg: "bg-emerald-500", text: "text-white" },
  { bg: "bg-violet-500", text: "text-white" },
  { bg: "bg-amber-500", text: "text-white" },
  { bg: "bg-rose-500", text: "text-white" },
  { bg: "bg-cyan-500", text: "text-white" },
  { bg: "bg-indigo-500", text: "text-white" },
  { bg: "bg-teal-500", text: "text-white" },
  { bg: "bg-orange-500", text: "text-white" },
  { bg: "bg-pink-500", text: "text-white" },
  { bg: "bg-lime-600", text: "text-white" },
  { bg: "bg-fuchsia-500", text: "text-white" },
];

// Icônes pour les organisations
const AVATAR_ICONS: LucideIcon[] = [
  Building2,
  Factory,
  Store,
  Warehouse,
  Building,
  Landmark,
  Castle,
  Hotel,
  School,
  Hospital,
  Briefcase,
  Package,
  Boxes,
  Container,
  Truck,
];

// Génère un hash stable à partir d'une chaîne
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

interface OrganizationAvatarProps {
  name: string;
  logoUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  xs: "size-5",
  sm: "size-6",
  md: "size-8",
  lg: "size-10",
  xl: "size-14",
};

const iconSizeClasses = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
  xl: "size-7",
};

export function OrganizationAvatar({
  name,
  logoUrl,
  size = "md",
  className,
}: OrganizationAvatarProps) {
  // Si un logo est fourni, l'afficher
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className={cn(
          "rounded-lg object-cover",
          sizeClasses[size],
          className
        )}
      />
    );
  }

  // Générer couleur et icône basées sur le hash du nom
  const hash = hashString(name);
  const colorIndex = hash % AVATAR_COLORS.length;
  const iconIndex = hash % AVATAR_ICONS.length;

  const color = AVATAR_COLORS[colorIndex];
  const IconComponent = AVATAR_ICONS[iconIndex];

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg",
        sizeClasses[size],
        color.bg,
        color.text,
        className
      )}
    >
      <IconComponent className={iconSizeClasses[size]} />
    </div>
  );
}

// Hook pour obtenir la couleur et l'icône d'une organisation
export function useOrganizationStyle(name: string) {
  const hash = hashString(name);
  const colorIndex = hash % AVATAR_COLORS.length;
  const iconIndex = hash % AVATAR_ICONS.length;

  return {
    color: AVATAR_COLORS[colorIndex],
    Icon: AVATAR_ICONS[iconIndex],
  };
}

// Exporter pour usage externe
export { AVATAR_COLORS, AVATAR_ICONS };
