"use client";

import * as React from "react";

/**
 * Profondeur d'une couche modale.
 *
 * Ouvrir une modale par-dessus une autre donnait deux cadres identiques,
 * decales de quelques pixels : meme fond, meme bordure, meme ombre. L'oeil ne
 * lisait pas « une fenetre devant une autre » mais un doublon, comme si
 * l'ecran s'etait copie tout seul — et rien ne disait ou agir.
 *
 * Le registre tient la pile des couches ouvertes, dans leur ordre d'ouverture.
 * Seule celle du dessus reste au premier plan ; les autres reculent.
 *
 * Un registre au niveau du module, et non un contexte React : une modale
 * enfant n'est pas toujours rendue dans l'arbre de sa parente — beaucoup sont
 * des soeurs, montees a cote pour eviter l'empilement de portails. Un contexte
 * ne les verrait pas.
 */
let stack: number[] = [];
let nextId = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Identifiant de la couche du dessus, 0 si aucune n'est ouverte. */
function topLayer() {
  return stack[stack.length - 1] ?? 0;
}

/**
 * Cette couche est-elle recouverte par une autre ?
 *
 * A appeler depuis le contenu d'une modale : il ne se monte que lorsqu'elle
 * s'ouvre, l'inscription suit donc sa duree de vie.
 */
export function useIsBehindDialog(): boolean {
  const id = React.useMemo(() => ++nextId, []);

  React.useEffect(() => {
    stack.push(id);
    emit();
    return () => {
      stack = stack.filter((layer) => layer !== id);
      emit();
    };
  }, [id]);

  // L'inscription elle-meme declenche le re-rendu : `emit` change la couche du
  // dessus, que ce hook observe. Pas d'etat local a tenir en parallele — il
  // dirait la meme chose avec un temps de retard.
  //
  // Le rendu serveur ne connait aucune pile : la couche n'est jamais reculee
  // avant l'hydratation, ce qui est le sens sans risque — une modale trop
  // nette se remarque moins qu'une modale effacee sans raison.
  const top = React.useSyncExternalStore(subscribe, topLayer, () => 0);

  // `includes` couvre le premier rendu, avant que l'effet n'ait inscrit la
  // couche : elle n'est alors dans la pile de personne, donc au premier plan.
  return top !== id && stack.includes(id);
}

/**
 * Classes d'une couche recouverte.
 *
 * Elle recule et s'estompe au lieu de rester nette derriere. `pointer-events`
 * n'est pas touche : la primitive gere deja le piegeage du focus et les clics,
 * et le lui retirer casserait la fermeture au clic exterieur.
 */
export const BEHIND_DIALOG_CLASSES =
  "scale-[0.96] opacity-45 blur-[1px] transition-[scale,opacity,filter] duration-200 ease-out";

/**
 * Meme effet pour un panneau lateral, sans le retrait d'echelle.
 *
 * Un panneau est colle a un bord de l'ecran : le reduire le decollerait, et
 * ce decollement se lirait comme un defaut d'affichage plutot que comme un
 * eloignement.
 */
export const BEHIND_SHEET_CLASSES =
  "opacity-45 blur-[1px] transition-[opacity,filter] duration-200 ease-out";
