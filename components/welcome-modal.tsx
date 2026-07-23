"use client";

import { useEffect, useState } from "react";
import { PackageOpen } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Mot d'accueil affiche une seule fois, a la premiere arrivee dans l'appli.
 *
 * « Vu » est memorise par compte dans le navigateur (une cle par user id) :
 * aucun champ en base n'est necessaire, et deux comptes sur le meme poste
 * voient chacun leur accueil. Un nouvel appareil le reaffichera une fois — ce
 * qui, pour un simple mot de bienvenue, est sans consequence.
 */
const SEEN_PREFIX = "istock-welcome-seen:";

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      const alreadySeen = localStorage.getItem(SEEN_PREFIX + user.id);
      if (!alreadySeen) {
        setUserId(user.id);
        setOpen(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    if (userId) localStorage.setItem(SEEN_PREFIX + userId, "1");
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Fermer par la croix, l'exterieur ou Echap vaut « j'ai vu » : on ne
        // veut pas le repressenter au prochain chargement.
        if (!next) dismiss();
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mb-2 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PackageOpen className="size-7" />
          </div>
          <DialogTitle className="text-xl">Bienvenue sur istock</DialogTitle>
          <DialogDescription>
            Votre compte est prêt. Gérez vos stocks, vos entrées et vos sorties en quelques clics.
          </DialogDescription>
        </DialogHeader>
        <Button className="w-full" onClick={dismiss}>
          Démarrer maintenant
        </Button>
      </DialogContent>
    </Dialog>
  );
}
