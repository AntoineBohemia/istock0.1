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
 * Mot d'accueil affiche une seule fois, definitivement.
 *
 * « Vu » est memorise dans les metadonnees du compte (auth.users), pas dans le
 * navigateur : c'est lie au compte, pas a l'appareil, donc la modale
 * n'apparait qu'a la toute premiere arrivee sur istock — jamais sur un second
 * poste ni apres vidage du cache. Aucun champ ajoute au schema : on ecrit dans
 * raw_user_meta_data via updateUser, que l'utilisateur a le droit de modifier
 * pour lui-meme.
 */
export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      if (!user.user_metadata?.welcomed) {
        setOpen(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    // Fermeture immediate : on n'attend pas le reseau pour retirer la modale.
    setOpen(false);
    const supabase = createClient();
    // Marque le compte comme accueilli. En cas d'echec reseau, la modale
    // pourra reapparaitre une fois — sans consequence pour un simple accueil.
    void supabase.auth.updateUser({ data: { welcomed: true } });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Fermer par la croix, l'exterieur ou Echap vaut « j'ai vu ».
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
