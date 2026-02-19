"use client";

import { useState } from "react";
import Link from "next/link";
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
  MoreHorizontal,
  Package,
  Eye,
  Pencil,
  Archive,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { TechnicianWithInventory } from "@/lib/supabase/queries/technicians";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useTechnicians } from "@/hooks/queries";
import { useArchiveTechnician } from "@/hooks/mutations";

function generateInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TechniciansList() {
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const { data: technicians = [], isLoading } = useTechnicians(currentOrganization?.id);
  const archiveTechnicianMutation = useArchiveTechnician();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [technicianToDelete, setTechnicianToDelete] =
    useState<TechnicianWithInventory | null>(null);

  const isArchiving = archiveTechnicianMutation.isPending;

  const handleArchive = async () => {
    if (!technicianToDelete) return;

    archiveTechnicianMutation.mutate(technicianToDelete.id, {
      onSuccess: () => {
        toast.success("Technicien archivé avec succès");
        setDeleteDialogOpen(false);
        setTechnicianToDelete(null);
      },
      onError: (error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Erreur lors de l'archivage"
        );
        setDeleteDialogOpen(false);
        setTechnicianToDelete(null);
      },
    });
  };

  const columns: ColumnDef<TechnicianWithInventory>[] = [
    {
      accessorKey: "name",
      header: "Nom",
      accessorFn: (row) => `${row.first_name} ${row.last_name}`,
      cell: ({ row }) => (
        <Link
          href={`/users/${row.original.id}`}
          className="flex items-center gap-4 hover:underline"
        >
          <Avatar>
            <AvatarFallback>
              {generateInitials(
                row.original.first_name,
                row.original.last_name
              )}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">
              {row.original.first_name} {row.original.last_name}
            </div>
            {row.original.email && (
              <div className="text-sm text-muted-foreground">
                {row.original.email}
              </div>
            )}
          </div>
        </Link>
      ),
    },
    {
      accessorKey: "city",
      header: ({ column }) => (
        <Button
          className="-ml-3"
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Ville
          <ArrowUpDown />
        </Button>
      ),
      cell: ({ row }) => row.original.city || "-",
    },
    {
      accessorKey: "phone",
      header: "Téléphone",
      cell: ({ row }) => row.original.phone || "-",
    },
    {
      accessorKey: "inventory_count",
      header: ({ column }) => (
        <Button
          className="-ml-3"
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Inventaire
          <ArrowUpDown />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Package className="size-4 text-muted-foreground" />
          <Badge variant={row.original.inventory_count > 0 ? "secondary" : "outline"}>
            {row.original.inventory_count} items
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: "last_restock_at",
      header: ({ column }) => (
        <Button
          className="-ml-3"
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Dernier restock
          <ArrowUpDown />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <RefreshCw className="size-4 text-muted-foreground" />
          <span>{formatDate(row.original.last_restock_at)}</span>
        </div>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <span className="sr-only">Actions</span>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/users/${row.original.id}`}>
                <Eye className="mr-2 size-4" />
                Voir le profil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/users/${row.original.id}/edit`}>
                <Pencil className="mr-2 size-4" />
                Modifier
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                setTechnicianToDelete(row.original);
                setDeleteDialogOpen(true);
              }}
            >
              <Archive className="mr-2 size-4" />
              Archiver
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const table = useReactTable({
    data: technicians,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  if (isLoading || isOrgLoading) {
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
                placeholder="Rechercher un technicien..."
                value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  table.getColumn("name")?.setFilterValue(event.target.value)
                }
                className="max-w-sm pl-9"
              />
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
                      <TableRow key={row.id}>
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
                          Aucun technicien trouvé.{" "}
                          <Link
                            href="/users/create"
                            className="text-primary hover:underline"
                          >
                            Ajouter un technicien
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-end space-x-2">
              <div className="text-muted-foreground flex-1 text-sm">
                {table.getFilteredRowModel().rows.length} technicien(s)
              </div>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
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
            <AlertDialogTitle>Archiver le technicien ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>
                {technicianToDelete?.first_name} {technicianToDelete?.last_name}
              </strong>{" "}
              sera archivé et ne sera plus visible dans les listes et
              statistiques.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isArchiving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isArchiving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Archiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
