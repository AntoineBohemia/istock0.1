"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
  getStockMovements,
  StockMovement,
  MovementType,
  MOVEMENT_TYPE_LABELS,
} from "@/lib/supabase/queries/stock-movements";
import { createClient } from "@/lib/supabase/client";
import CreateMovementDialog from "./create-movement-dialog";

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
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const handleRowClick = (movement: StockMovement) => {
    if (movement.movement_type === "entry") {
      router.push(`/orders/income/${movement.id}`);
    } else {
      router.push(`/orders/outcome/${movement.id}`);
    }
  };

  // Filtres
  const [filterType, setFilterType] = useState<string>("all");
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [filterTechnician, setFilterTechnician] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>();
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>();

  const loadMovements = async () => {
    setIsLoading(true);
    try {
      const filters: Parameters<typeof getStockMovements>[0] = {
        page,
        pageSize: 20,
      };

      if (filterType && filterType !== "all") {
        filters.movementType = filterType as MovementType;
      }
      if (filterProduct && filterProduct !== "all") {
        filters.productId = filterProduct;
      }
      if (filterTechnician && filterTechnician !== "all") {
        filters.technicianId = filterTechnician;
      }
      if (filterStartDate) {
        filters.startDate = filterStartDate.toISOString();
      }
      if (filterEndDate) {
        filters.endDate = filterEndDate.toISOString();
      }

      const result = await getStockMovements(filters);
      setMovements(result.movements);
      setTotalCount(result.total);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors du chargement des mouvements"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadFiltersData = async () => {
    const supabase = createClient();

    const [productsRes, techniciansRes] = await Promise.all([
      supabase.from("products").select("id, name").order("name"),
      supabase
        .from("technicians")
        .select("id, first_name, last_name")
        .order("last_name"),
    ]);

    setProducts(productsRes.data || []);
    setTechnicians(techniciansRes.data || []);
  };

  useEffect(() => {
    loadFiltersData();
  }, []);

  useEffect(() => {
    loadMovements();
  }, [page, filterType, filterProduct, filterTechnician, filterStartDate, filterEndDate]);

  const handleSuccess = () => {
    loadMovements();
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
    setFilterType("all");
    setFilterProduct("all");
    setFilterTechnician("all");
    setFilterStartDate(undefined);
    setFilterEndDate(undefined);
    setPage(1);
  };

  const hasActiveFilters =
    filterType !== "all" ||
    filterProduct !== "all" ||
    filterTechnician !== "all" ||
    filterStartDate ||
    filterEndDate;

  if (isLoading && movements.length === 0) {
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
              className="ml-auto"
              onClick={() => setCreateDialogOpen(true)}
            >
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
        onSuccess={handleSuccess}
      />
    </>
  );
}
