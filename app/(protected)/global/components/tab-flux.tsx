"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ImageIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { RecentMovement } from "@/lib/supabase/queries/dashboard";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useRecentMovements } from "@/hooks/queries";

const MOVEMENT_BADGE_STYLES: Record<string, string> = {
  entry:
    "border-green-400 bg-green-100 text-green-900 dark:border-green-700 dark:bg-green-900 dark:text-white",
  exit_technician:
    "border-blue-400 bg-blue-100 text-blue-900 dark:border-blue-700 dark:bg-blue-900 dark:text-white",
  exit_anonymous:
    "border-gray-400 bg-gray-100 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white",
  exit_loss:
    "border-red-400 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-900 dark:text-white",
};

const MOVEMENT_LABELS: Record<string, string> = {
  entry: "Entree",
  exit_technician: "Sortie tech.",
  exit_anonymous: "Sortie anon.",
  exit_loss: "Perte",
};

type FilterType = "all" | "entry" | "exit_technician" | "exit_anonymous" | "exit_loss";

const columns: ColumnDef<RecentMovement>[] = [
  {
    accessorKey: "product",
    header: "Produit",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="size-8 shrink-0 rounded-full border bg-muted flex items-center justify-center overflow-hidden">
          {row.original.product?.image_url ? (
            <Image
              src={row.original.product.image_url}
              width={32}
              height={32}
              alt={row.original.product.name}
              className="size-full rounded-full object-cover"
            />
          ) : (
            <ImageIcon className="size-4 text-muted-foreground" />
          )}
        </div>
        <span className="text-sm font-medium truncate">
          {row.original.product?.name}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "movement_type",
    header: "Type",
    cell: ({ row }) => (
      <Badge
        className={cn(
          "border shrink-0 text-[10px] px-1.5 py-0",
          MOVEMENT_BADGE_STYLES[row.original.movement_type]
        )}
      >
        {MOVEMENT_LABELS[row.original.movement_type] || row.original.movement_type}
      </Badge>
    ),
  },
  {
    accessorKey: "quantity",
    header: "Quantite",
    cell: ({ row }) => (
      <span
        className={cn(
          "font-semibold text-sm tabular-nums",
          row.original.movement_type === "entry"
            ? "text-green-600"
            : "text-red-600"
        )}
      >
        {row.original.movement_type === "entry" ? "+" : "-"}
        {row.original.quantity}
      </span>
    ),
  },
  {
    accessorKey: "technician",
    header: "Technicien",
    cell: ({ row }) => {
      const tech = row.original.technician;
      if (!tech) return <span className="text-xs text-muted-foreground">-</span>;
      return (
        <span className="text-sm text-muted-foreground">
          {tech.first_name} {tech.last_name}
        </span>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: "Date",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {format(
          new Date(row.original.created_at ?? Date.now()),
          "dd MMM yyyy, HH:mm",
          { locale: fr }
        )}
      </span>
    ),
  },
];

function FluxSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-[160px]" />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Skeleton className="h-4 w-16" /></TableHead>
              <TableHead><Skeleton className="h-4 w-12" /></TableHead>
              <TableHead><Skeleton className="h-4 w-14" /></TableHead>
              <TableHead><Skeleton className="h-4 w-16" /></TableHead>
              <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-3 w-28" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function TabFlux() {
  const router = useRouter();
  const { currentOrganization } = useOrganizationStore();
  const orgId = currentOrganization?.id;
  const { data: movements = [], isLoading } = useRecentMovements(orgId, 20);
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredMovements = useMemo(() => {
    if (filter === "all") return movements;
    return movements.filter((m) => m.movement_type === filter);
  }, [movements, filter]);

  const table = useReactTable({
    data: filteredMovements,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return <FluxSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredMovements.length} mouvement{filteredMovements.length > 1 ? "s" : ""}
        </p>
        <Select value={filter} onValueChange={(val) => setFilter(val as FilterType)}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="entry">Entrees</SelectItem>
            <SelectItem value="exit_technician">Sorties tech.</SelectItem>
            <SelectItem value="exit_anonymous">Sorties anon.</SelectItem>
            <SelectItem value="exit_loss">Pertes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredMovements.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-muted-foreground text-sm">
          Aucun mouvement
        </div>
      ) : (
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
                  onClick={() => router.push(`/orders/${row.original.id}`)}
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
      )}

      <Button variant="outline" className="w-full" asChild>
        <Link href="/orders">Voir tout l&apos;historique</Link>
      </Button>
    </div>
  );
}
