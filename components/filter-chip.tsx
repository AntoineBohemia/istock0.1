"use client";

import { Check, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface FilterChipOption {
  id: string;
  label: string;
  /** Compteur affiche a droite de l'option */
  count?: number;
}

interface FilterChipProps {
  label: string;
  icon: LucideIcon;
  options: FilterChipOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
  /** Masque la pastille quand il n'y a rien a choisir */
  hideWhenEmpty?: boolean;
  align?: "start" | "end";
}

/**
 * Pastille de filtre a choix multiple.
 *
 * Les quatre filtres de la page Mouvements (societe, fournisseur, technicien,
 * type) etaient quatre popovers recopies a l'identique : changer leur taille
 * demandait la meme correction a trois endroits, et l'un d'eux avait deja
 * diverge. Un seul composant rend l'incoherence impossible.
 */
export function FilterChip({
  label,
  icon: Icon,
  options,
  selected,
  onToggle,
  onClear,
  hideWhenEmpty = true,
  align = "start",
}: FilterChipProps) {
  if (hideWhenEmpty && options.length === 0) return null;

  const active = selected.size > 0;

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full h-9 px-4 text-[13px] font-semibold transition-all select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97]",
          active
            ? "bg-primary text-primary-foreground"
            : "bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.10]"
        )}
      >
        <Icon className="size-3" />
        {label}
        {active && (
          <>
            <span className="opacity-80 tabular-nums font-heading">{selected.size}</span>
            <span
              role="button"
              aria-label={`Retirer le filtre ${label}`}
              className="ml-0.5 rounded-full hover:bg-white/20 p-0.5 -mr-1"
              onClick={(e) => {
                // Sans cela, le clic ouvrirait aussi le popover qu'on vient de vider
                e.stopPropagation();
                onClear();
              }}
            >
              <X className="size-3" />
            </span>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto min-w-[180px] p-1 rounded-xl overflow-hidden">
        <div className="flex flex-col gap-0.5 max-h-[280px] overflow-y-auto">
          {options.map((opt) => {
            const isSelected = selected.has(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                className={cn(
                  "flex items-center gap-2 text-[13px] px-3 py-1.5 rounded-lg transition-colors",
                  isSelected
                    ? "bg-primary/10 text-foreground font-medium"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground"
                )}
                onClick={() => onToggle(opt.id)}
              >
                {/* La coche garde sa place meme masquee : sans cela, les
                    libelles se decalent a chaque selection. */}
                <span
                  className={cn(
                    "size-3.5 flex items-center justify-center shrink-0",
                    !isSelected && "opacity-0"
                  )}
                >
                  <Check className="size-3.5" />
                </span>
                <span className="flex-1 text-left">{opt.label}</span>
                {opt.count !== undefined && (
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {opt.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
