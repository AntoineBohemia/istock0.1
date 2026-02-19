"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ImageIcon, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getStockScoreBgColor } from "@/lib/utils/stock";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useProductsNeedingRestock } from "@/hooks/queries";
import type { ProductNeedingRestock } from "@/lib/supabase/queries/dashboard";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const columns: ColumnDef<ProductNeedingRestock>[] = [
  {
    accessorKey: "name",
    header: "Produit",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="size-8 shrink-0 rounded-md border bg-muted flex items-center justify-center overflow-hidden">
          {row.original.image_url ? (
            <Image
              src={row.original.image_url}
              width={32}
              height={32}
              alt={row.original.name}
              className="size-full object-cover"
            />
          ) : (
            <ImageIcon className="size-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{row.original.name}</p>
          {row.original.sku && (
            <p className="text-xs text-muted-foreground">{row.original.sku}</p>
          )}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "stock_current",
    header: ({ column }) => (
      <Button
        className="-ml-3"
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Stock
        <ArrowUpDown className="ml-1 size-3.5" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="tabular-nums font-medium">
        {row.original.stock_current ?? 0}
      </span>
    ),
  },
  {
    id: "min_max",
    header: "Min / Max",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {row.original.stock_min ?? 0} / {row.original.stock_max ?? 0}
      </span>
    ),
  },
  {
    accessorKey: "score",
    header: ({ column }) => (
      <Button
        className="-ml-3"
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Score
        <ArrowUpDown className="ml-1 size-3.5" />
      </Button>
    ),
    cell: ({ row }) => {
      const score = row.original.score;
      return (
        <div className="flex items-center gap-2 min-w-[100px]">
          <Progress
            value={score}
            className="h-2 flex-1"
            indicatorColor={getStockScoreBgColor(score)}
          />
          <span className="text-xs tabular-nums w-8 text-right">{score}%</span>
        </div>
      );
    },
    sortingFn: "basic",
  },
  {
    accessorKey: "last_movement_at",
    header: "Dernier mvt",
    cell: ({ row }) => {
      const date = row.original.last_movement_at;
      if (!date) return <span className="text-xs text-muted-foreground">-</span>;
      return (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr })}
        </span>
      );
    },
  },
];

export function TabProduits() {
  const router = useRouter();
  const { currentOrganization } = useOrganizationStore();
  const orgId = currentOrganization?.id;

  const { data: products = [], isLoading } = useProductsNeedingRestock(orgId, 20, 60);
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "score", desc: false },
  ]);

  const table = useReactTable({
    data: products,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                <TableHead><Skeleton className="h-4 w-10" /></TableHead>
                <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                <TableHead><Skeleton className="h-4 w-12" /></TableHead>
                <TableHead><Skeleton className="h-4 w-20" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-8 rounded-md" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-3 w-14" /></TableCell>
                  <TableCell><Skeleton className="h-2 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-3 w-16" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="rounded-full bg-emerald-100 p-3 dark:bg-emerald-950/40">
          <CheckCircle className="size-6 text-emerald-500" />
        </div>
        <div className="text-center">
          <p className="font-medium">Tous les produits sont en bon etat</p>
          <p className="text-sm text-muted-foreground">
            Aucun produit avec un score inferieur a 60%
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {products.length} produit{products.length > 1 ? "s" : ""} avec un score &lt; 60%
      </p>
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
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/product/${row.original.id}`)}
              >
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
    </div>
  );
}
