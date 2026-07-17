import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueryErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function QueryError({
  message = "Impossible de charger les données.",
  onRetry,
}: QueryErrorProps) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 mb-3">
          <AlertTriangle className="size-5 text-destructive" />
        </div>
        <p className="text-sm font-medium">{message}</p>
        <p className="text-xs text-muted-foreground mt-1">Vérifiez votre connexion et réessayez.</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
            <RefreshCw className="mr-2 size-3.5" />
            Réessayer
          </Button>
        )}
      </div>
    </div>
  );
}
