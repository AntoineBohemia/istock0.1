"use client";

import { useState } from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import * as React from "react";

// Define the data type for our table
type Project = {
  id: string;
  name: string;
  client: string;
  status: "active" | "completed" | "on-hold" | "cancelled";
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  progress: number;
  manager: string;
};

// Sample data for the table
const data: Project[] = [
  {
    id: "PRJ-001",
    name: "Website Redesign",
    client: "Acme Inc.",
    status: "active",
    startDate: "2025-01-15",
    endDate: "2025-04-30",
    budget: 12500,
    spent: 5200,
    progress: 42,
    manager: "John Smith"
  },
  {
    id: "PRJ-002",
    name: "Mobile App Development",
    client: "TechCorp",
    status: "active",
    startDate: "2025-02-01",
    endDate: "2025-06-15",
    budget: 35000,
    spent: 12800,
    progress: 36,
    manager: "Sarah Johnson"
  },
  {
    id: "PRJ-003",
    name: "Brand Identity",
    client: "GreenLife",
    status: "completed",
    startDate: "2024-11-10",
    endDate: "2025-01-20",
    budget: 8500,
    spent: 8500,
    progress: 100,
    manager: "Michael Brown"
  },
  {
    id: "PRJ-004",
    name: "E-commerce Platform",
    client: "Fashion Hub",
    status: "active",
    startDate: "2025-01-05",
    endDate: "2025-05-10",
    budget: 42000,
    spent: 18600,
    progress: 44,
    manager: "Emily Davis"
  },
  {
    id: "PRJ-005",
    name: "SEO Optimization",
    client: "Local Bistro",
    status: "on-hold",
    startDate: "2025-02-15",
    endDate: "2025-04-15",
    budget: 4500,
    spent: 1200,
    progress: 27,
    manager: "David Wilson"
  },
  {
    id: "PRJ-006",
    name: "Content Marketing",
    client: "EduTech",
    status: "active",
    startDate: "2025-01-20",
    endDate: "2025-07-20",
    budget: 18000,
    spent: 4500,
    progress: 25,
    manager: "Lisa Anderson"
  },
  {
    id: "PRJ-007",
    name: "CRM Implementation",
    client: "Global Services",
    status: "active",
    startDate: "2025-02-10",
    endDate: "2025-05-30",
    budget: 28000,
    spent: 9800,
    progress: 35,
    manager: "Robert Taylor"
  },
  {
    id: "PRJ-008",
    name: "Social Media Campaign",
    client: "FitLife Gym",
    status: "completed",
    startDate: "2024-12-01",
    endDate: "2025-02-28",
    budget: 7500,
    spent: 7500,
    progress: 100,
    manager: "Jennifer Martinez"
  },
  {
    id: "PRJ-009",
    name: "Product Launch",
    client: "Innovate Tech",
    status: "active",
    startDate: "2025-03-01",
    endDate: "2025-04-15",
    budget: 15000,
    spent: 3200,
    progress: 21,
    manager: "Thomas Clark"
  },
  {
    id: "PRJ-010",
    name: "Office Redesign",
    client: "Creative Studios",
    status: "on-hold",
    startDate: "2025-01-10",
    endDate: "2025-03-30",
    budget: 22000,
    spent: 8900,
    progress: 40,
    manager: "Amanda Lewis"
  },
  {
    id: "PRJ-011",
    name: "Data Migration",
    client: "Finance Pro",
    status: "active",
    startDate: "2025-02-20",
    endDate: "2025-04-10",
    budget: 9500,
    spent: 4200,
    progress: 44,
    manager: "Kevin White"
  },
  {
    id: "PRJ-012",
    name: "Security Audit",
    client: "SecureBank",
    status: "completed",
    startDate: "2025-01-05",
    endDate: "2025-02-15",
    budget: 12000,
    spent: 12000,
    progress: 100,
    manager: "Patricia Moore"
  },
  {
    id: "PRJ-013",
    name: "Video Production",
    client: "Media House",
    status: "active",
    startDate: "2025-02-15",
    endDate: "2025-05-01",
    budget: 18500,
    spent: 7200,
    progress: 39,
    manager: "James Wilson"
  },
  {
    id: "PRJ-014",
    name: "HR System Upgrade",
    client: "Corporate Inc.",
    status: "cancelled",
    startDate: "2025-01-10",
    endDate: "2025-04-10",
    budget: 14000,
    spent: 3500,
    progress: 25,
    manager: "Michelle Johnson"
  },
  {
    id: "PRJ-015",
    name: "Market Research",
    client: "New Ventures",
    status: "active",
    startDate: "2025-03-01",
    endDate: "2025-05-15",
    budget: 8500,
    spent: 2100,
    progress: 25,
    manager: "Daniel Brown"
  },
  {
    id: "PRJ-016",
    name: "Cloud Migration",
    client: "Tech Solutions",
    status: "active",
    startDate: "2025-02-10",
    endDate: "2025-06-30",
    budget: 32000,
    spent: 12800,
    progress: 40,
    manager: "Christopher Lee"
  },
  {
    id: "PRJ-017",
    name: "Training Program",
    client: "Education First",
    status: "on-hold",
    startDate: "2025-01-15",
    endDate: "2025-03-15",
    budget: 6500,
    spent: 2600,
    progress: 40,
    manager: "Jessica Taylor"
  },
  {
    id: "PRJ-018",
    name: "Annual Report Design",
    client: "Investment Group",
    status: "completed",
    startDate: "2024-12-15",
    endDate: "2025-02-28",
    budget: 9000,
    spent: 9000,
    progress: 100,
    manager: "Andrew Martin"
  },
  {
    id: "PRJ-019",
    name: "Customer Support Portal",
    client: "Service Pro",
    status: "active",
    startDate: "2025-02-01",
    endDate: "2025-05-15",
    budget: 16500,
    spent: 6800,
    progress: 41,
    manager: "Stephanie Garcia"
  },
  {
    id: "PRJ-020",
    name: "Inventory System",
    client: "Retail Chain",
    status: "active",
    startDate: "2025-01-20",
    endDate: "2025-04-30",
    budget: 21000,
    spent: 9450,
    progress: 45,
    manager: "Brian Wilson"
  }
];

// Define the columns for our table
const columns: ColumnDef<Project>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <div>{row.getValue("id")}</div>
  },
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="p-0!"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Project Name
          <ArrowUpDown className="size-3" />
        </Button>
      );
    },
    cell: ({ row }) => <div>{row.getValue("name")}</div>
  },
  {
    accessorKey: "client",
    header: "Client",
    cell: ({ row }) => <div>{row.getValue("client")}</div>
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as
        | "pending"
        | "active"
        | "completed"
        | "cancelled"
        | "on-hold";

      const statusClassMap: Record<typeof status, string> = {
        pending: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
        active: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
        completed: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
        cancelled: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
        "on-hold": "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200"
      };

      return <Badge className={`capitalize ${statusClassMap[status]}`}>{status}</Badge>;
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    }
  },
  {
    accessorKey: "startDate",
    header: "Start Date",
    cell: ({ row }) => {
      const date = new Date(row.getValue("startDate"));
      return <div>{date.toLocaleDateString()}</div>;
    }
  },
  {
    accessorKey: "endDate",
    header: "End Date",
    cell: ({ row }) => {
      const date = new Date(row.getValue("endDate"));
      return <div>{date.toLocaleDateString()}</div>;
    }
  },
  {
    accessorKey: "budget",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="p-0!"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Budget
          <ArrowUpDown className="size-3" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const amount = Number.parseFloat(row.getValue("budget"));
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
      }).format(amount);

      return <div>{formatted}</div>;
    }
  },
  {
    accessorKey: "progress",
    header: "Progress",
    cell: ({ row }) => {
      const progress = Number.parseInt(row.getValue("progress"));

      return (
        <div className="w-full">
          <div className="flex items-center">
            <Progress value={progress} />
            <span className="ml-2 text-xs">{progress}%</span>
          </div>
        </div>
      );
    }
  }
];

export function Reports() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter
    },
    initialState: {
      pagination: {
        pageSize: 15
      }
    }
  });

  return (
    <div className="space-y-4">
      <div className="z-0 mt-0 flex items-center justify-start gap-3 lg:-mt-14 lg:justify-end">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            placeholder="Search projects..."
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-[250px] pl-8 md:w-[300px]"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Columns <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}>
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
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

      {/* Pagination controls */}
      <div className="flex items-center justify-between space-x-2">
        <div className="text-muted-foreground text-sm">
          Showing {table.getFilteredRowModel().rows.length} of {data.length} projects
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}>
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
