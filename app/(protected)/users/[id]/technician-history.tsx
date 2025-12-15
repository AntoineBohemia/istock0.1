"use client";

import { useEffect, useState } from "react";
import { Loader2, History, Package } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getTechnicianInventoryHistory,
  TechnicianInventoryHistoryEntry,
} from "@/lib/supabase/queries/technicians";

interface TechnicianHistoryProps {
  technicianId: string;
}

export default function TechnicianHistory({
  technicianId,
}: TechnicianHistoryProps) {
  const [history, setHistory] = useState<TechnicianInventoryHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [technicianId]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await getTechnicianInventoryHistory(technicianId);
      setHistory(data);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors du chargement de l'historique"
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des restocks</CardTitle>
        <CardDescription>
          {history.length === 0
            ? "Aucun restock effectué"
            : `${history.length} restock(s) enregistré(s)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="size-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">
              Aucun historique de restock disponible.
            </p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {history.map((entry, index) => (
              <AccordionItem key={entry.id} value={entry.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Package className="size-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">
                        Restock du{" "}
                        {new Date(entry.created_at).toLocaleDateString(
                          "fr-FR",
                          {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(entry.created_at).toLocaleTimeString(
                          "fr-FR",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}{" "}
                        -{" "}
                        {entry.snapshot.total_items} item(s)
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="rounded-md border ml-12">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produit</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-right">Quantité</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entry.snapshot.items.map((item, itemIndex) => (
                          <TableRow key={itemIndex}>
                            <TableCell className="font-medium">
                              {item.product_name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.product_sku || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{item.quantity}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
