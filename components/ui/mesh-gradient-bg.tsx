"use client";

import { cn } from "@/lib/utils";

interface MeshGradientBgProps {
  className?: string;
}

export function MeshGradientBg({ className }: MeshGradientBgProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 -z-10 overflow-hidden pointer-events-none",
        className
      )}
      aria-hidden="true"
    >
      {/* Base subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />

      {/* Mesh blob - top left (blue) */}
      <div
        className="absolute -top-[20%] -left-[10%] h-[60%] w-[50%] rounded-full opacity-[0.03] blur-[100px] dark:opacity-[0.07]"
        style={{
          background:
            "radial-gradient(circle, hsl(217, 91%, 60%) 0%, transparent 70%)",
        }}
      />

      {/* Mesh blob - top right (violet) */}
      <div
        className="absolute -top-[10%] -right-[15%] h-[50%] w-[45%] rounded-full opacity-[0.025] blur-[120px] dark:opacity-[0.06]"
        style={{
          background:
            "radial-gradient(circle, hsl(262, 83%, 58%) 0%, transparent 70%)",
        }}
      />

      {/* Mesh blob - bottom right (emerald) */}
      <div
        className="absolute -bottom-[15%] -right-[10%] h-[55%] w-[50%] rounded-full opacity-[0.02] blur-[100px] dark:opacity-[0.05]"
        style={{
          background:
            "radial-gradient(circle, hsl(160, 84%, 39%) 0%, transparent 70%)",
        }}
      />

      {/* Mesh blob - center left (blue subtle) */}
      <div
        className="absolute top-[40%] -left-[20%] h-[40%] w-[40%] rounded-full opacity-[0.015] blur-[80px] dark:opacity-[0.04]"
        style={{
          background:
            "radial-gradient(circle, hsl(217, 91%, 60%) 0%, transparent 70%)",
        }}
      />

      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
