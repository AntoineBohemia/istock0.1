"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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

/** Jour local au format ISO court, sans passer par UTC qui decalerait la date. */
function dateSlugOf(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function ExportStockPopover({
  organizationId,
  organizations = [],
  isMultiOrg,
}: ExportStockPopoverProps) {
  const today = new Date();
  // Cinq ans en arriere : au-dela, l'historique des mouvements ne couvre plus
  // la periode et le stock reconstitue serait faux sans le dire.
  const earliest = new Date(today.getFullYear() - 5, 0, 1);

  const [date, setDate] = useState<Date>(today);
  const [filterOrgId, setFilterOrgId] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(false);

  const dateLabel = formatDateFR(date);

  // Fin de journee : un export « au 30 juin » doit contenir les mouvements du
  // 30 juin. Arreter a minuit les perdrait tous.
  const targetDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  ).toISOString();

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
        toast.error("Aucun produit à exporter à cette date.");
        return;
      }

      await exportStockAtDateExcel({
        data,
        dateLabel,
        dateSlug: dateSlugOf(date),
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
      <PopoverContent align="end" className="w-[300px] p-4 rounded-xl">
        <div className="space-y-4">
          {/* Date arretee — n'importe quel jour, pas seulement une fin d'annee.
              Un inventaire se justifie a une date precise : cloture, audit,
              passage d'expert-comptable. */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Stock au jour</label>
            <DatePicker
              value={date}
              onChange={(d) => setDate(d ?? today)}
              disabled={{ after: today, before: earliest }}
              className="mt-1 w-full"
              // Le calendrier s'ouvre dans un portail : sans niveau explicite,
              // il passait sous le popover qui le contient.
              popoverClassName="z-[60]"
            />
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

          {/* Ce que contiendra le fichier, en une phrase : le stock d'un jour,
              et un seul chiffre par produit. */}
          <p className="text-xs text-muted-foreground text-center">
            Stock de chaque produit au {dateLabel}
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
