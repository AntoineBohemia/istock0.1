"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
  label?: string;
  className?: string;
}

export function BackButton({ label = "Retour", className }: BackButtonProps) {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label={label}
      onClick={() => router.back()}
    >
      <ArrowLeft className="size-4" />
    </Button>
  );
}
