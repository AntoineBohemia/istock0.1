────────────────────────────────────────
CHANTIER 1 — Cohérence des deux modes, light par défaut (global)
────────────────────────────────────────
- Le mode par défaut au chargement reste LIGHT. Ne change pas ce comportement.
- Garde le toggle clair/sombre existant et fonctionnel.
- Vérifie que TOUTES les couleurs custom passent par des tokens
  (voir §2 DESIGN_SYSTEM.md), aucune couleur codée en dur, pour que les DEUX
  modes restent corrects. Ajoute la couche statut si elle manque
  (critique/attention/standard), en définissant les valeurs pour :root ET .dark.
- Après ce chantier, l'app doit être lisible et cohérente dans les deux modes
  sur les trois pages concernées, sans texte invisible ni contraste cassé.
- Priorité de test : light (mode par défaut) d'abord, puis vérifier le dark.

────────────────────────────────────────
CHANTIER 2 — Typographie identitaire (global)
────────────────────────────────────────
- Vérifie que Space Grotesk et Inter sont réellement chargées et câblées
  (--font-heading = Space Grotesk, --font-sans = Inter). Supprime Oxanium.
- Applique Space Grotesk à TOUS les affichages numériques, pas seulement aux
  titres : chiffres héros (valeur totale, totaux), stocks dans les tableaux,
  prix, valeurs des metric cards restantes, dates de restock.
  Actuellement ces chiffres rendent en sans par défaut, c'est le correctif
  le plus important, ne le rate pas.
- Ajoute font-variant-numeric: tabular-nums sur toute colonne numérique et
  tout chiffre héros (alignement).
- Corps, labels, contenu de tableau non numérique : restent en Inter.

────────────────────────────────────────
CHANTIER 3 — Page "Stock produits" : nettoyage + renommage
────────────────────────────────────────
Retirer (déjà spécifié) :
- La metric card "Stock global".
- Dans le tableau : la barre de progression et le pourcentage sous chaque
  stock, et la valeur max. Le stock reste un chiffre coloré par statut.
- Le bouton "Exporter CSV".
- Le filtre "Toutes les catégories" (liste déroulante) et la colonne
  "Catégorie".
- La colonne d'actions "..." (copier l'id, voir détails, modifier).
Conserver :
- La metric card "Valeur totale du stock".
- Les coches de sélection de ligne (pour actions groupées sur les lignes
  cochées).
- La pastille de statut, et le chiffre de stock coloré par statut.
Renommer / ajouter :
- "Restocker" devient "Entrer produit".
- Ajouter un bouton "Sortir produit".
- Inverser le poids visuel : "Entrer produit" en bouton accent violet plein,
  "Ajouter un produit" en bouton neutre contour.
Tri :
- Tri actif sur TOUTES les colonnes du tableau.

────────────────────────────────────────
CHANTIER 4 — Page "Techniciens" : nettoyage
────────────────────────────────────────
Retirer (déjà spécifié) :
- Toutes les metric cards SAUF "Total techniciens", que tu gardes affiché
  quelque part de discret (un simple compteur, pas une grande card).
- La colonne d'actions "...".
Modifier :
- Colonne "Ville" → "Département" (le header ET la donnée : ce sont déjà des
  numéros de département dans les données, corrige le libellé et la source).
- Colonne "Téléphone" : applique la décision que je t'aurai donnée
  (Email / Département / suppression). Ne devine pas.
- Inventaire des techniciens géré par année civile (période par défaut =
  année civile en cours, personnalisable).
Tri :
- Tri actif sur toutes les colonnes.

────────────────────────────────────────
CHANTIER 5 — Console (page Vue d'ensemble) : corriger la double action
────────────────────────────────────────
- Il y a actuellement DEUX zones d'action redondantes : les boutons
  Entrée/Sortie en haut du bloc produit actif, ET la barre quantité + Entrer
  en bas de page. Fusionne-les en UNE seule zone.
- Zone unique : champ quantité + bouton "Entrer" (accent) + bouton "Sortir"
  (neutre, avec choix sortie technicien / sortie autre), directement dans le
  bloc produit actif, sous le statut.
- Conserve le flux clavier (recherche autofocus, flèches, Entrée valide) et le
  journal "Session en cours" à droite.

────────────────────────────────────────
INTERDITS
────────────────────────────────────────
- N'ajoute AUCUN nouvel effet, animation décorative, couleur, ou élément
  ludique. Ce chantier affirme l'identité par la cohérence et la soustraction,
  pas par l'ajout. La couche Motion existante ne change pas.
- Ne réutilise pas les couleurs de statut comme décoration.
- Ne code pas la société ni la décision email en dur.
- Ne casse pas les pages non citées ni le routing.

À la fin de chaque chantier : build OK, app OK, et liste-moi ce que tu as
changé fichier par fichier.
