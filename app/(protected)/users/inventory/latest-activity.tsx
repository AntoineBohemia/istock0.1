"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheckIcon,
  BriefcaseBusinessIcon,
  ClockIcon,
  DownloadCloud,
} from "lucide-react";
import { MoreHorizontal, Info, Undo2, UserPlus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DownloadIcon } from "@radix-ui/react-icons";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
  TableBody,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

export type Asset = {
  id: string;
  name: string;
  serial?: string;
  category: "Laptop" | "Phone" | "Accessory" | "Other";
  status: "assigned" | "available" | "maintenance" | "retired";
  assignedTo?: string; // user id
  assignedAt?: string; // ISO date
  dueAt?: string; // ISO date
};

// --- Mock data ---
const MOCK_ASSETS: Asset[] = [
  {
    id: "P-001",
    name: "5L White Paint Bucket",
    serial: "PB-1001",
    category: "Other",
    status: "assigned",
    assignedTo: "u-1",
    assignedAt: "2025-07-02",
    dueAt: "2025-12-31",
  },
  {
    id: "P-002",
    name: "Fine Bristle Brush",
    serial: "BR-2005",
    category: "Accessory",
    status: "available",
  },
  {
    id: "P-003",
    name: "Medium Paint Roller",
    serial: "RL-3030",
    category: "Accessory",
    status: "maintenance",
  },
  {
    id: "P-004",
    name: "3-Step Ladder",
    serial: "LD-450",
    category: "Other",
    status: "assigned",
    assignedTo: "u-1",
    assignedAt: "2025-05-14",
  },
  {
    id: "P-005",
    name: "Protective Plastic Sheet",
    serial: "PS-900",
    category: "Other",
    status: "available",
  },
  {
    id: "P-006",
    name: "Roller Extension Pole",
    serial: "EP-777",
    category: "Accessory",
    status: "assigned",
    assignedTo: "u-2",
    assignedAt: "2025-06-01",
    dueAt: "2025-10-01",
  },
];

function statusBadge(status: Asset["status"]) {
  const map: Record<
    Asset["status"],
    {
      label: string;
      variant?: "default" | "secondary" | "destructive" | "outline";
    }
  > = {
    assigned: { label: "Attribué", variant: "default" },
    available: { label: "Dispo", variant: "secondary" },
    maintenance: { label: "Maintenance", variant: "outline" },
    retired: { label: "Retiré", variant: "destructive" },
  };
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function LatestActivity() {
  const user = { id: "u-1", name: "Franc Dupont", email: "franc@fidy.ai" };
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [openSheet, setOpenSheet] = useState<Asset | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [unassignOpen, setUnassignOpen] = useState(false);

  const assets = useMemo(() => {
    return MOCK_ASSETS.filter(
      (a) => a.assignedTo === user.id || a.status !== "assigned"
    ) // include all but highlight user's
      .filter((a) => (status === "all" ? true : a.status === status))
      .filter((a) =>
        [a.name, a.serial, a.id]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())
      );
  }, [query, status]);

  const myAssets = useMemo(
    () => MOCK_ASSETS.filter((a) => a.assignedTo === user.id),
    []
  );

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );
  return (
    <Card>
      <ScrollArea className="max-h-[520px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>ID</TableHead>
              <TableHead className="min-w-[220px]">Actif</TableHead>
              <TableHead>N° série</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Attribué le</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead className="w-10 text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((a) => (
              <TableRow key={a.id} className="hover:bg-muted/40">
                <TableCell>
                  <Checkbox
                    checked={!!selected[a.id]}
                    onCheckedChange={(v) =>
                      setSelected((s) => ({ ...s, [a.id]: Boolean(v) }))
                    }
                    aria-label={`Select ${a.id}`}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {a.id}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-muted" />
                    <div>
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.assignedTo === user.id
                          ? "Possédé par cet utilisateur"
                          : a.assignedTo
                          ? "Attribué à un autre utilisateur"
                          : "Non attribué"}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{a.serial ?? "—"}</TableCell>
                <TableCell>{a.category}</TableCell>
                <TableCell>{statusBadge(a.status)}</TableCell>
                <TableCell>
                  {a.assignedAt
                    ? new Date(a.assignedAt).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell>
                  {a.dueAt ? new Date(a.dueAt).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setOpenSheet(a)}
                        className="gap-2"
                      >
                        <Info className="h-4 w-4" /> Détail
                      </DropdownMenuItem>
                      {a.assignedTo ? (
                        <DropdownMenuItem
                          onClick={() => setUnassignOpen(true)}
                          className="gap-2"
                        >
                          <Undo2 className="h-4 w-4" /> Retirer
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => setAssignOpen(true)}
                          className="gap-2"
                        >
                          <UserPlus className="h-4 w-4" /> Attribuer
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-2 text-destructive">
                        <Trash2 className="h-4 w-4" /> Archiver
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Pagination (simple) */}
      <div className="flex items-center justify-between p-3">
        <div className="text-xs text-muted-foreground">
          {assets.length} résultats
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Précédent
          </Button>
          <Button variant="outline" size="sm">
            Suivant
          </Button>
        </div>
      </div>
    </Card>
  );
}
