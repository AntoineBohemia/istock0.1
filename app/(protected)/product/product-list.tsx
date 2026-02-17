"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ColumnsIcon,
  Download,
  FilterIcon,
  Loader2,
  MoreHorizontal,
  Package,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  getProducts,
  deleteProduct,
  ProductWithCategory,
} from "@/lib/supabase/queries/products";
import { getCategories, Category } from "@/lib/supabase/queries/categories";
import {
  calculateStockScore,
  getStockScoreBgColor,
  getStockBadgeVariant,
  getStockStatus,
} from "@/lib/utils/stock";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import QuickStockMovementModal from "@/components/quick-stock-movement-modal";
import { exportToCSV } from "@/lib/utils/csv-export";

export default function ProductList() {
  const router = useRouter();
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] =
    useState<ProductWithCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced search
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategory]);

  const loadData = useCallback(async () => {
    if (!currentOrganization) return;

    setIsLoading(true);
    try {
      const [productsResult, categoriesData] = await Promise.all([
        getProducts({
          organizationId: currentOrganization.id,
          search: debouncedSearch || undefined,
          categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
          page,
          pageSize,
        }),
        getCategories(currentOrganization.id),
      ]);
      setProducts(productsResult.products);
      setTotalCount(productsResult.total);
      setCategories(categoriesData);
    } catch (error) {
      toast.error("Erreur lors du chargement des produits");
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization?.id, page, debouncedSearch, selectedCategory]);

  useEffect(() => {
    if (!isOrgLoading && currentOrganization) {
      loadData();
    }
  }, [currentOrganization?.id, isOrgLoading, page, debouncedSearch, selectedCategory]);

  const handleDelete = async () => {
    if (!productToDelete) return;

    setIsDeleting(true);
    try {
      await deleteProduct(productToDelete.id);
      toast.success("Produit supprimé avec succès");
      setDeleteDialogOpen(false);
      setProductToDelete(null);
      loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la suppression"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCSV = () => {
    exportToCSV(products, "produits", [
      { header: "Nom", accessor: (p) => p.name },
      { header: "SKU", accessor: (p) => p.sku },
      { header: "Catégorie", accessor: (p) => p.category?.name },
      { header: "Prix", accessor: (p) => p.price },
      { header: "Stock actuel", accessor: (p) => p.stock_current },
      { header: "Stock min", accessor: (p) => p.stock_min },
      { header: "Stock max", accessor: (p) => p.stock_max },
    ]);
  };

  const columns: ColumnDef<ProductWithCategory>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Tout sélectionner"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Sélectionner la ligne"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          className="-ml-3"
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Produit
          <ArrowUpDown className="size-3" />
        </Button>
      ),
      cell: ({ row }) => {
        const product = row.original;
        return (
          <Link
            href={`/product/${product.id}`}
            className="flex items-center gap-4 hover:underline"
          >
            <figure className="flex size-12 items-center justify-center rounded-lg border bg-muted">
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  width={48}
                  height={48}
                  className="rounded-lg object-cover"
                  alt={product.name}
                />
              ) : (
                <Package className="size-5 text-muted-foreground" />
              )}
            </figure>
            <div>
              <div className="font-medium">{product.name}</div>
              {product.sku && (
                <div className="text-xs text-muted-foreground">
                  {product.sku}
                </div>
              )}
            </div>
          </Link>
        );
      },
    },
    {
      accessorKey: "price",
      header: ({ column }) => (
        <Button
          className="-ml-3"
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Prix
          <ArrowUpDown className="size-3" />
        </Button>
      ),
      cell: ({ row }) => {
        const price = row.original.price;
        return price
          ? price.toLocaleString("fr-FR", {
              style: "currency",
              currency: "EUR",
            })
          : "-";
      },
    },
    {
      accessorKey: "category",
      header: "Catégorie",
      cell: ({ row }) => {
        const category = row.original.category;
        return category ? (
          <Badge variant="outline">{category.name}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "stock_current",
      header: ({ column }) => (
        <Button
          className="-ml-3"
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Stock
          <ArrowUpDown className="size-3" />
        </Button>
      ),
      cell: ({ row }) => {
        const product = row.original;
        const score = calculateStockScore(
          product.stock_current,
          product.stock_min,
          product.stock_max
        );
        const bgColor = getStockScoreBgColor(score);

        return (
          <div className="w-32 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{product.stock_current}</span>
              <span className="text-muted-foreground">{score}%</span>
            </div>
            <Progress value={score} className="h-2" indicatorColor={bgColor} />
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) => {
        const product = row.original;
        const score = calculateStockScore(
          product.stock_current,
          product.stock_min,
          product.stock_max
        );
        const variant = getStockBadgeVariant(score);
        const status = getStockStatus(score);

        return <Badge variant={variant}>{status}</Badge>;
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const product = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="size-8 p-0">
                <span className="sr-only">Menu</span>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setSelectedProductId(product.id);
                  setStockModalOpen(true);
                }}
              >
                <RefreshCw className="mr-2 size-4" />
                Restocker
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/product/${product.id}`}>Voir détails</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/product/${product.id}/edit`}>Modifier</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(product.id)}
              >
                Copier l'ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  setProductToDelete(product);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="mr-2 size-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: products,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  if (isLoading || isOrgLoading || !currentOrganization) {
    return (
      <Card>
        <CardContent className="flex h-96 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {categories
                    .filter((c) => !c.parent_id)
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="size-4" />
                <span className="hidden lg:inline">Exporter CSV</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <span className="hidden lg:inline">Colonnes</span>
                    <ColumnsIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {column.id === "name"
                          ? "Produit"
                          : column.id === "price"
                            ? "Prix"
                            : column.id === "category"
                              ? "Catégorie"
                              : column.id === "stock_current"
                                ? "Stock"
                                : column.id === "status"
                                  ? "Statut"
                                  : column.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full space-y-4">
            <div className="rounded-lg border">
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
                        data-state={row.getIsSelected() && "selected"}
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
                        <div className="text-muted-foreground">
                          Aucun produit trouvé.{" "}
                          <Link
                            href="/product/create"
                            className="text-primary hover:underline"
                          >
                            Créer un produit
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                {totalCount} produit(s) au total
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
                  disabled={products.length < pageSize}
                >
                  Suivant
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le produit</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer &quot;{productToDelete?.name}
              &quot; ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QuickStockMovementModal
        open={stockModalOpen}
        onClose={() => {
          setStockModalOpen(false);
          setSelectedProductId(null);
          loadData(); // Refresh data after stock movement
        }}
        productId={selectedProductId}
      />
    </>
  );
}
