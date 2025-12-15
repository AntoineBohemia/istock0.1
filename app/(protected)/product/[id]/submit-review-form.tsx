"use client";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CirclePlusIcon } from "lucide-react";
import { DialogDescription } from "@radix-ui/react-dialog";
import React from "react";

export default function SubmitReviewForm() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CirclePlusIcon /> Ajouter un flux
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un flux de stock</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Saisissez les détails du mouvement de stock pour ce produit.
          </DialogDescription>
        </DialogHeader>
        <form className="mt-4 grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Ex: Réapprovisionnement fournisseur principal"
              rows={4}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type">Type de flux</Label>
            <Input id="type" placeholder="Entrée, Sortie, Réservation..." />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quantity">Quantité</Label>
            <Input id="quantity" placeholder="Ex: +200 L ou -50 L" />
          </div>
          <Button className="w-full">Ajouter le flux</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
