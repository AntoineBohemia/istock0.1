"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Loader2, PackagePlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useAllTechniciansForDashboard } from "@/hooks/queries";
import type { TechnicianDashboardRow } from "@/lib/supabase/queries/dashboard";

interface TabTechniciensProps {
  onRestockClick: (techId: string) => void;
}

function getDaysSinceColor(days: number): string {
  if (days === -1) return "text-red-500";
  if (days > 14) return "text-red-500";
  if (days > 7) return "text-orange-500";
  return "text-muted-foreground";
}

export function TabTechniciens({ onRestockClick }: TabTechniciensProps) {
  const router = useRouter();
  const { currentOrganization } = useOrganizationStore();
  const orgId = currentOrganization?.id;

  const { data: technicians = [], isLoading } = useAllTechniciansForDashboard(orgId);
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const columns: ColumnDef<TechnicianDashboardRow>[] = React.useMemo(
    () => [
      {
        accessorKey: "first_name",
        header: "Technicien",
        cell: ({ row }) => (
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/users/${row.original.id}`);
            }}
          >
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">
                {getInitials(`${row.original.first_name} ${row.original.last_name}`)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">
              {row.original.first_name} {row.original.last_name}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "inventory_item_count",
        header: ({ column }) => (
          <Button
            className="-ml-3"
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Items
            <ArrowUpDown className="ml-1 size-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">
            {row.original.inventory_item_count} ({row.original.total_inventory_quantity} u.)
          </span>
        ),
      },
      {
        accessorKey: "days_since_restock",
        header: ({ column }) => (
          <Button
            className="-ml-3"
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Dernier restock
            <ArrowUpDown className="ml-1 size-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const { last_restock_at, days_since_restock } = row.original;
          if (!last_restock_at) {
            return <span className="text-xs text-red-500 font-medium">Jamais restocke</span>;
          }
          return (
            <span className={cn("text-xs", getDaysSinceColor(days_since_restock))}>
              {formatDistanceToNow(new Date(last_restock_at), { addSuffix: true, locale: fr })}
            </span>
          );
        },
        sortingFn: "basic",
      },
      {
        accessorKey: "coverage_pct",
        header: ({ column }) => (
          <Button
            className="-ml-3"
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Couverture
            <ArrowUpDown className="ml-1 size-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className={cn("text-xs tabular-nums font-medium", row.original.coverage_pct < 50 ? "text-orange-500" : "text-muted-foreground")}>
            {row.original.coverage_pct}%
          </span>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onRestockClick(row.original.id);
            }}
          >
            <PackagePlus className="size-3.5 mr-1" />
            Restocker
          </Button>
        ),
      },
    ],
    [onRestockClick, router]
  );

  const table = useReactTable({
    data: technicians,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });

  if (isLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (technicians.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <p className="text-muted-foreground">Aucun technicien actif</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
