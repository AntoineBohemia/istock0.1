"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQueryStates, parseAsString, parseAsInteger, parseAsIsoDate } from "nuqs";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  Download,
  Loader2,
  ImageIcon,
  ArrowDownToLine,
  ArrowUpFromLine,
  PlusCircle,
  FilterIcon,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  StockMovement,
  MovementType,
  MOVEMENT_TYPE_LABELS,
} from "@/lib/supabase/queries/stock-movements";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import CreateMovementDialog from "./create-movement-dialog";
import { exportToCSV } from "@/lib/utils/csv-export";
import { useStockMovements, useTechnicians } from "@/hooks/queries";
import { useProducts } from "@/hooks/queries";

const MOVEMENT_BADGE_VARIANTS: Record<
  MovementType,
  "success" | "info" | "secondary" | "destructive"
> = {
  entry: "success",
  exit_technician: "info",
  exit_anonymous: "secondary",
  exit_loss: "destructive",
};

interface Product {
  id: string;
  name: string;
}

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
}

export default function MovementsList() {
  const router = useRouter();
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // URL-synced filters via nuqs
  const [filters, setFilters] = useQueryStates({
    type: parseAsString.withDefault("all"),
    product: parseAsString.withDefault("all"),
    technician: parseAsString.withDefault("all"),
    startDate: parseAsIsoDate,
    endDate: parseAsIsoDate,
    page: parseAsInteger.withDefault(1),
  });

  const filterType = filters.type;
  const filterProduct = filters.product;
  const filterTechnician = filters.technician;
  const filterStartDate = filters.startDate ?? undefined;
  const filterEndDate = filters.endDate ?? undefined;
  const page = filters.page;

  const setFilterType = (value: string) => setFilters({ type: value, page: 1 });
  const setFilterProduct = (value: string) => setFilters({ product: value, page: 1 });
  const setFilterTechnician = (value: string) => setFilters({ technician: value, page: 1 });
  const setFilterStartDate = (value: Date | undefined) => setFilters({ startDate: value ?? null, page: 1 });
  const setFilterEndDate = (value: Date | undefined) => setFilters({ endDate: value ?? null, page: 1 });
  const setPage = (value: number | ((prev: number) => number)) => {
    const newPage = typeof value === "function" ? value(page) : value;
    setFilters({ page: newPage });
  };

  const handleRowClick = (movement: StockMovement) => {
    if (movement.movement_type === "entry") {
      router.push(`/orders/income/${movement.id}`);
    } else {
      router.push(`/orders/outcome/${movement.id}`);
    }
  };

  // React Query hooks
  const { data: movementsResult, isLoading } = useStockMovements({
    organizationId: currentOrganization?.id,
    page,
    pageSize: 20,
    movementType: filterType !== "all" ? (filterType as MovementType) : undefined,
    productId: filterProduct !== "all" ? filterProduct : undefined,
    technicianId: filterTechnician !== "all" ? filterTechnician : undefined,
    startDate: filterStartDate?.toISOString(),
    endDate: filterEndDate?.toISOString(),
  });

  const { data: productsResult } = useProducts({ organizationId: currentOrganization?.id, pageSize: 1000 });
  const { data: techniciansData = [] } = useTechnicians(currentOrganization?.id);

  const movements = movementsResult?.movements || [];
  const totalCount = movementsResult?.total || 0;
  const products: Product[] = (productsResult?.products || []).map(p => ({ id: p.id, name: p.name }));
  const technicians: Technician[] = techniciansData.map(t => ({ id: t.id, first_name: t.first_name, last_name: t.last_name }));

  const handleExportCSV = () => {
    exportToCSV(movements, "mouvements", [
      { header: "Date", accessor: (m) => new Date(m.created_at).toLocaleDateString("fr-FR") },
      { header: "Type", accessor: (m) => MOVEMENT_TYPE_LABELS[m.movement_type] },
      { header: "Produit", accessor: (m) => m.product?.name },
      { header: "Quantité", accessor: (m) => m.quantity },
      { header: "Technicien", accessor: (m) => m.technician ? `${m.technician.first_name} ${m.technician.last_name}` : "" },
      { header: "Notes", accessor: (m) => m.notes },
    ]);
  };

  const columns: ColumnDef<StockMovement>[] = [
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button
          className="-ml-3"
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date
          <ArrowUpDown className="ml-2 size-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.original.created_at);
        return (
          <div className="text-sm">
            <div>{format(date, "dd MMM yyyy", { locale: fr })}</div>
            <div className="text-muted-foreground">
              {format(date, "HH:mm", { locale: fr })}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "movement_type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.original.movement_type;
        const isEntry = type === "entry";

        return (
          <div className="flex items-center gap-2">
            {isEntry ? (
              <ArrowDownToLine className="size-4 text-green-600" />
            ) : (
              <ArrowUpFromLine className="size-4 text-red-600" />
            )}
            <Badge variant={MOVEMENT_BADGE_VARIANTS[type]}>
              {MOVEMENT_TYPE_LABELS[type]}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "product",
      header: "Produit",
      cell: ({ row }) => {
        const product = row.original.product;
        return (
          <div className="flex items-center gap-3">
            <figure className="flex size-10 items-center justify-center rounded-lg border bg-muted">
              {product?.image_url ? (
                <Image
                  src={product.image_url}
                  width={40}
                  height={40}
                  alt={product.name}
                  className="size-full rounded-lg object-cover"
                />
              ) : (
                <ImageIcon className="size-5 text-muted-foreground" />
              )}
            </figure>
            <div>
              <p className="font-medium">{product?.name || "Produit inconnu"}</p>
              {product?.sku && (
                <p className="text-xs text-muted-foreground">{product.sku}</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: "Quantité",
      cell: ({ row }) => {
        const isEntry = row.original.movement_type === "entry";
        return (
          <span
            className={`font-semibold ${isEntry ? "text-green-600" : "text-red-600"}`}
          >
            {isEntry ? "+" : "-"}
            {row.original.quantity}
          </span>
        );
      },
    },
    {
      accessorKey: "technician",
      header: "Technicien",
      cell: ({ row }) => {
        const technician = row.original.technician;
        if (!technician) return <span className="text-muted-foreground">-</span>;
        return (
          <span>
            {technician.first_name} {technician.last_name}
          </span>
        );
      },
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.notes || "-"}
        </span>
      ),
    },
  ];

  const table = useReactTable({
    data: movements,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  const clearFilters = () => {
    setFilters({
      type: "all",
      product: "all",
      technician: "all",
      startDate: null,
      endDate: null,
      page: 1,
    });
  };

  const hasActiveFilters =
    filterType !== "all" ||
    filterProduct !== "all" ||
    filterTechnician !== "all" ||
    filterStartDate ||
    filterEndDate;

  if ((isLoading || isOrgLoading) && movements.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-4 pt-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Rechercher..."
              className="max-w-xs"
              onChange={(e) =>
                table.getColumn("product")?.setFilterValue(e.target.value)
              }
            />

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="entry">Entrées</SelectItem>
                <SelectItem value="exit_technician">Technicien</SelectItem>
                <SelectItem value="exit_anonymous">Anonyme</SelectItem>
                <SelectItem value="exit_loss">Perte</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Produit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les produits</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterTechnician} onValueChange={setFilterTechnician}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Technicien" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les techniciens</SelectItem>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.first_name} {t.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon">
                  <Calendar className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  selected={{
                    from: filterStartDate,
                    to: filterEndDate,
                  }}
                  onSelect={(range) => {
                    setFilterStartDate(range?.from);
                    setFilterEndDate(range?.to);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                Effacer les filtres
              </Button>
            )}

            <Button
              variant="outline"
              className="ml-auto"
              onClick={handleExportCSV}
            >
              <Download className="size-4" />
              Exporter CSV
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <PlusCircle className="size-4" />
              Nouveau mouvement
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      onClick={() => handleRowClick(row.original)}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      Aucun mouvement trouvé.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {totalCount} mouvement(s) au total
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={movements.length < 20}
              >
                Suivant
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <CreateMovementDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {}}
      />
    </>
  );
}
