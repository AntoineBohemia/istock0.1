"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  backLabel?: string;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** @deprecated Use router.back() instead */
  backHref?: string;
}

export function PageHeader({ backLabel = "Retour", title, subtitle, actions }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 -ml-2"
            aria-label={backLabel}
            onClick={() => router.back()}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold tracking-tight truncate">{title}</h1>
            {subtitle}
          </div>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
