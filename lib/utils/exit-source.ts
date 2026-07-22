/**
 * Quelle societe est debitee par une sortie.
 *
 * Regle metier : on puise chez celle qui en a le moins. Les deux societes
 * partagent le meme catalogue et se reapprovisionnent ensemble ; vider d'abord
 * le petit stock evite de se retrouver avec une societe a zero et l'autre
 * pleine, situation ou il faut un transfert pour servir un technicien.
 *
 * Le choix ne depend donc plus de la societe affichee en haut de l'application :
 * il se deduit du produit et de la quantite demandee.
 */
export interface OrgStock {
  id: string;
  name: string;
  stock: number;
}

/**
 * Societe qui fournira les `quantity` unites, ou `null` si aucune n'en detient.
 *
 * Une sortie ne se decoupe pas entre societes : le stock sort d'une seule, sinon
 * un mouvement de vingt unites deviendrait deux lignes que rien ne relie. Ne
 * sont donc candidates que celles qui couvrent la quantite a elles seules — la
 * plus petite l'emporte parmi elles.
 *
 * Quand aucune ne couvre, on renvoie la mieux fournie : elle ne suffira pas,
 * mais c'est celle dont le stock doit apparaitre dans le message d'erreur et la
 * limite du compteur. Renvoyer `null` la ferait passer pour une rupture totale
 * alors qu'il reste de la marchandise.
 */
export function pickExitSource(orgStock: OrgStock[], quantity: number): OrgStock | null {
  const held = orgStock.filter((o) => o.stock > 0);
  if (held.length === 0) return null;

  const covering = held.filter((o) => o.stock >= quantity);
  const pool = covering.length > 0 ? covering : held;

  // Tri par nom a egalite de stock : sans lui, deux societes au meme niveau
  // designeraient tantot l'une tantot l'autre selon l'ordre de la requete, et
  // le libelle changerait sous les yeux de l'utilisateur sans qu'il ait touche
  // a quoi que ce soit.
  return [...pool].sort((a, b) =>
    covering.length > 0
      ? a.stock - b.stock || a.name.localeCompare(b.name, "fr")
      : b.stock - a.stock || a.name.localeCompare(b.name, "fr")
  )[0];
}

/**
 * Plus grosse quantite sortable en une fois.
 *
 * C'est le stock de la societe la mieux fournie, et non le cumul : le cumul
 * laisserait saisir un nombre qu'aucune societe ne peut honorer.
 */
export function maxSingleOrgStock(orgStock: OrgStock[]): number {
  return orgStock.reduce((max, o) => Math.max(max, o.stock), 0);
}
