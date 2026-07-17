"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { getStockAtDate } from "@/lib/supabase/queries/stock-at-date";
import { exportStockAtDateExcel } from "@/lib/utils/excel-export";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Organization {
  id: string;
  name: string;
}

interface ExportStockPopoverProps {
  organizationId: string;
  organizations?: Organization[];
  isMultiOrg: boolean;
}

function formatDateFR(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ExportStockPopover({
  organizationId,
  organizations = [],
  isMultiOrg,
}: ExportStockPopoverProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [filterOrgId, setFilterOrgId] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(false);

  const canGoBack = year > currentYear - 5;
  const canGoForward = year < currentYear;

  const isCurrentYear = year === currentYear;

  const startDate = new Date(year, 0, 1);
  const endDate = isCurrentYear ? new Date() : new Date(year, 11, 31, 23, 59, 59, 999);

  const startLabel = formatDateFR(startDate);
  const endLabel = formatDateFR(endDate);

  const targetDate = endDate.toISOString();

  // Org scope: list all org names or the filtered one
  const filteredOrg = filterOrgId ? organizations.find((o) => o.id === filterOrgId) : null;

  const orgScope = filteredOrg
    ? filteredOrg.name
    : organizations.map((o) => o.name).join(", ") || "—";

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await getStockAtDate(organizationId, targetDate, filterOrgId || null);

      if (data.length === 0) {
        toast.error("Aucun produit à exporter pour cette période.");
        return;
      }

      await exportStockAtDateExcel({
        data,
        year,
        startLabel,
        endLabel,
        orgScope,
        isFiltered: !!filterOrgId,
      });
      toast.success(`Export généré — ${data.length} produit${data.length > 1 ? "s" : ""}`);
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la génération de l'export.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">Export stock</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] p-4 rounded-xl">
        <div className="space-y-4">
          {/* Year selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Année civile</label>
            <div className="flex items-center justify-center gap-1 mt-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={!canGoBack}
                onClick={() => setYear((y) => y - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="font-heading text-lg font-bold tabular-nums min-w-[4ch] text-center">
                {year}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={!canGoForward}
                onClick={() => setYear((y) => y + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Org filter */}
          {isMultiOrg && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Société</label>
              <select
                value={filterOrgId}
                onChange={(e) => setFilterOrgId(e.target.value)}
                className={cn(
                  "mt-1 w-full rounded-lg border bg-card px-3 py-2 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-ring"
                )}
              >
                <option value="">Toutes ({organizations.length})</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date info */}
          <p className="text-xs text-muted-foreground text-center">
            Du {startLabel} au {endLabel}
          </p>

          {/* Export button */}
          <Button onClick={handleExport} disabled={exporting} className="w-full">
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileDown className="size-4" />
            )}
            {exporting ? "Génération..." : "Télécharger Excel"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
