"use client";

import { SlidersHorizontal } from "lucide-react";
import type { Table } from "@tanstack/react-table";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Libellé lisible d'une colonne, à renseigner via `meta.label` dans les ColumnDef. */
interface ColumnMetaWithLabel {
  label?: string;
}

/**
 * Menu « Colonnes » : permet d'afficher/masquer les colonnes d'un tableau TanStack.
 * Ne liste que les colonnes masquables (`enableHiding !== false`).
 * Le libellé provient de `column.columnDef.meta.label`, sinon de l'id de colonne.
 */
export function TableColumnToggle<T>({
  table,
  className,
}: {
  table: Table<T>;
  className?: string;
}) {
  const hideableColumns = table.getAllLeafColumns().filter((c) => c.getCanHide());
  if (hideableColumns.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all select-none cursor-pointer bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.10]",
          className
        )}
      >
        <SlidersHorizontal className="size-3" />
        Colonnes
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Colonnes affichées</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {hideableColumns.map((column) => {
            const label =
              (column.columnDef.meta as ColumnMetaWithLabel | undefined)?.label ?? column.id;
            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={column.getIsVisible()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
              >
                {label}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
