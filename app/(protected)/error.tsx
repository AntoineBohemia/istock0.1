"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
      <AlertTriangle className="size-10 text-destructive" />
      <h2 className="text-lg font-semibold">Une erreur est survenue</h2>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        {error.message || "Quelque chose s'est mal passé. Veuillez réessayer."}
      </p>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  );
}
