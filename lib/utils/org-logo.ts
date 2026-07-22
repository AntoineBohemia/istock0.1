/**
 * Logo d'une societe, cadre de facon homogene.
 *
 * Les fichiers envoyes dans `organizations.logo_url` n'ont aucun cadrage
 * commun : celui de SMPR fait 1920x1343 avec une large marge blanche autour
 * du disque, quand un autre serait un carre plein. Affiches cote a cote avec
 * `object-contain`, ils occupent la meme boite mais paraissent de tailles
 * tres differentes — le premier deux fois plus petit.
 *
 * On sert donc des copies detourees et carrees, livrees avec l'application.
 * SEIREN n'avait par ailleurs aucun logo enregistre : aucun ecran ne permet
 * d'en changer un apres la creation de la societe, `uploadOrganizationLogo`
 * n'etant appelee que pendant l'inscription.
 *
 * Contrepartie assumee : un logo change plus tard en base ne s'affichera pas
 * pour ces deux societes tant que cette table existe. La correction de fond
 * est de detourer a l'envoi et d'ajouter l'ecran manquant dans Parametres ;
 * cette table disparaitra alors.
 */
const NORMALIZED_LOGOS: Record<string, string> = {
  // Detoure depuis le fichier envoye : le disque remplit desormais le carre.
  smpr: "/logo/smpr.png",
  // Reconstitue depuis la version blanche de seiren.fr, teintee du vert de
  // leur charte (#6abf4b). Le S reste evide, il redevient blanc sur la carte.
  seirennn: "/logo/seiren.png",
};

export function organizationLogo(org: { slug: string; logo_url: string | null }): string | null {
  return NORMALIZED_LOGOS[org.slug] ?? org.logo_url ?? null;
}
