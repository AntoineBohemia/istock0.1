# Audit UX — iStock 0.1

Brainstorming intensif pour améliorer drastiquement l'expérience utilisateur.

---

## 1. Dashboard / Vue d'ensemble

Aujourd'hui `/actions` est la home mais c'est un outil opérationnel, pas un tableau de bord. Il manque une vue "état de santé du stock" au premier coup d'oeil.

- Carte KPI en haut : stock total valorisé, nb produits critiques, nb produits en attention, nb mouvements aujourd'hui, nb techniciens actifs
- Heatmap du stock : matrice colorée (vert/orange/rouge) de tous les produits, un carré par produit, cliquable
- Sparklines par produit : mini graphes inline dans la liste produits montrant la tendance 30j
- "À commander" en bannière persistante : badge rouge dans la sidebar quand X produits sont sous le seuil
- Activité temps réel : feed live des derniers mouvements (WebSocket via Supabase Realtime)
- Widget "top 5 consommateurs" ce mois : quels techniciens sortent le plus
- Widget "top 5 produits sortis" ce mois

---

## 2. Actions rapides / Flow opérationnel

- Raccourcis clavier globaux : `E` pour entrée, `S` pour sortie, `T` pour sortie technicien, `/` pour focus search — pas juste `Cmd+Z`
- Command palette (`Cmd+K`) : recherche universelle — produits, techniciens, fournisseurs, pages, actions — tout au même endroit
- Favoris / produits épinglés : les 5 produits les plus utilisés en raccourci en haut de la grille
- Mode "rafale" plus explicite : après une entrée, rester sur le même produit avec un compteur visuel "3 entrées cette session"
- Son de confirmation optionnel (bip court) en plus du vibrate — utile en entrepôt quand on ne regarde pas l'écran
- Historique du jour : filtrer par type (entrées / sorties) dans le panneau latéral
- Undo multi-niveaux : pas juste le dernier, mais les N derniers mouvements de la session
- Résumé de session : quand on quitte `/actions`, popup optionnel "Cette session : 12 entrées, 8 sorties, 3 produits touchés"
- Raccourci scan sur desktop aussi : activer la webcam pour scanner un QR depuis le PC
- Drag & drop produits vers le panier technicien au lieu de cliquer
- Quantités prédéfinies : boutons rapides x5, x10, x20 en plus du stepper +/-1
- Dernier mouvement identique : bouton "refaire" qui pré-remplit le dernier mouvement exact

---

## 3. Navigation & Architecture de l'information

- Breadcrumbs : on se perd dans la hiérarchie (Produits > Peinture blanche > Modifier)
- Tabs globaux au lieu d'une sidebar : Opérations | Stock | Équipe | Analyse — plus simple mentalement
- Sidebar : badges dynamiques — nombre de produits critiques sur "Produits", nombre d'invitations en attente sur "Équipe"
- Navigation récente : "Derniers consultés" dans la sidebar (3 derniers produits/techniciens visités)
- Sidebar collapsée : montrer les badges même en mode icônes-only
- Mobile : swipe entre les pages principales au lieu de tout rediriger vers `/actions`
- Mobile : ouvrir plus de pages — pourquoi bloquer `/produits`, `/mouvements` sur mobile ? Même en lecture seule
- Deep links QR : que le QR d'un produit mène à une page publique légère (pas besoin d'être connecté) pour l'inventaire terrain

---

## 4. Produits & Stock

- Vue carte ET vue liste : toggle entre grid (visuel, icônes) et table (dense, données)
- Tri rapide : boutons "Critique d'abord" / "A-Z" / "Dernière modif" en un clic
- Stock prédictif : "À ce rythme, rupture dans ~12 jours" basé sur la moyenne de sorties
- Alertes de stock : notification push/email quand un produit passe sous le seuil
- Historique de prix inline : dans la fiche produit, montrer l'évolution du prix unitaire (le composant `PriceHistory` existe mais est-il monté ?)
- Comparaison de produits : sélectionner 2-3 produits et voir côte à côte consommation, prix, stock
- Code-barres EAN en plus des QR codes : les produits BTP ont souvent un EAN existant
- Unités personnalisables : aujourd'hui tout est en "unités" — besoin de kg, litres, mètres, rouleaux, paquets
- Lots / numéros de série pour la traçabilité (surtout outillage)
- Photos multiples par produit : face, dos, étiquette, mise en situation
- Dupliquer un produit : bouton pour créer une variante rapidement
- Import CSV / Excel : ajouter 50 produits d'un coup au lieu de un par un
- Tags / étiquettes libres en plus des catégories : "chantier X", "urgent", "promo"
- Archivage réversible : pouvoir restaurer un produit archivé (pas juste le masquer)
- Notes / commentaires sur un produit : "attention lot 2024 défectueux"

---

## 5. Techniciens

- Vue carte mobile des techniciens : photo + nom + dernier réappro + badge stock critique — aujourd'hui c'est une liste texte
- Géolocalisation : carte avec position des techniciens (intégration GPS véhicule)
- Dotation standard : définir un kit type par technicien (ce qu'il devrait avoir) et comparer avec l'inventaire réel
- Inventaire terrain : le technicien scanne lui-même son stock depuis son téléphone — réconciliation
- Alertes réappro technicien : notification quand le stock d'un tech descend sous sa dotation standard
- Photo de camion : le technicien photographie son chargement comme preuve
- Signature de réception : le technicien signe sur tablette quand il reçoit du stock
- Historique condensé : timeline visuelle plutôt qu'un tableau — points sur une frise chronologique
- Score technicien : ratio consommation/rendement (si données de productivité disponibles)
- Groupes de techniciens : équipes, chantiers — pour des sorties groupées

---

## 6. Fournisseurs & Achats

- Catalogue fournisseur : associer un prix catalogue + délai de livraison par produit/fournisseur
- Comparaison de prix : même produit chez plusieurs fournisseurs, tableau comparatif
- Bon de commande PDF : générer un vrai PDF formaté au lieu d'un simple mailto
- Suivi de commande : statut "commandé > expédié > reçu" avec dates
- Intégration email : envoyer la commande directement depuis l'app (pas juste mailto)
- Récurrence de commande : commander automatiquement quand le stock passe sous le seuil
- Dashboard achats : évolution mensuelle des dépenses, top fournisseurs, répartition par catégorie
- Alerte budget : notification quand les achats du mois dépassent un seuil défini
- Historique des prix : graphe d'évolution du prix d'achat par fournisseur/produit
- Import facture : scan/photo de facture > OCR > pré-remplissage de l'entrée stock

---

## 7. Recherche & Filtres

- Recherche universelle (`Cmd+K`) : chercher partout — produits, techniciens, fournisseurs, mouvements — résultats groupés
- Recherche floue (fuzzy) : tolérance aux fautes de frappe ("peiture" > "peinture")
- Filtres sauvegardés : "Mes filtres" — sauvegarder une combinaison filtre+tri pour y revenir en un clic
- Filtre par plage de stock : slider "stock entre 0 et 50"
- Filtre par date de dernière entrée : "pas réapprovisionné depuis 30j"
- Recherche dans les mouvements par référence facture
- Auto-complétion dans la recherche avec preview des résultats

---

## 8. Visualisation de données & Analytics

- Monter le `TechnicianEvolution` : le composant existe, il faut l'activer (4e tab ou section dans le dashboard)
- Graphe consommation par catégorie : donut/pie chart — où part l'argent ?
- Courbe de stock temporelle par produit : superposer min/max/actuel sur 12 mois
- Comparaison année N vs N-1 : overlay sur les graphes
- Export PDF rapport mensuel : synthèse automatique avec graphes + KPIs
- Tableau croisé technicien x produit : qui consomme quoi — matrice interactive
- Saisonnalité : identifier les patterns (plus de peinture en été, plus de ciment en hiver)
- Anomalies détectées : "Ce technicien a consommé 3x plus que la moyenne ce mois"
- Coût par chantier si on ajoute la notion de chantier aux sorties

---

## 9. Mobile & Terrain

- Mode hors-ligne : les gars sur le chantier n'ont pas toujours du réseau — queue locale + sync
- PWA installable : icône sur l'écran d'accueil, splash screen, vraie app feeling
- Widget iOS/Android : voir les 3 produits les plus critiques sans ouvrir l'app
- Scan continu amélioré : ne pas fermer la caméra entre chaque scan, flux continu avec sons
- NFC : coller des tags NFC sur les étagères au lieu de QR codes
- Mode sombre automatique : basculer au coucher du soleil (les entrepôts sont souvent sombres)
- Gestes tactiles : swipe left sur un produit = sortie rapide, swipe right = entrée rapide
- Taille de texte adaptative : option "gros texte" pour les ouvriers sur le terrain
- Mode gants : boutons plus gros, zones de tap élargies pour utilisation avec des gants de travail
- Rotation écran : supporter le mode paysage sur tablette pour les tableaux

---

## 10. Collaboration & Multi-utilisateurs

- Notifications in-app : centre de notifications (cloche) avec badge — pas seulement des toasts éphémères
- Commentaires sur mouvements : "pourquoi cette sortie de 50 unités ?" — fil de discussion
- Validation workflow : les sorties au-dessus d'un certain montant nécessitent validation d'un admin
- Journal d'audit : qui a fait quoi, quand — accessible dans les paramètres
- Mentions : @technicien dans un commentaire de mouvement
- Rôle "viewer" : accès lecture seule pour le comptable/chef de chantier
- Multi-chantier : associer les sorties à un chantier spécifique pour ventiler les coûts
- Tableau de bord manager : vue agrégée de toutes les organisations

---

## 11. Onboarding & Éducation

- Tooltips contextuels au premier usage : "Cliquez ici pour votre première entrée stock" (coachmarks)
- Vidéo tutoriel intégrée : 2 min pour comprendre le flow
- Templates de démarrage : "Pack Électricien", "Pack Plombier", "Pack Peintre" — pré-remplir catégories + produits types
- Checklist de démarrage persistante : "Créer une orga", "Ajouter un produit", "Faire une première entrée", "Inviter un collègue"
- Mode démo : données fictives pour explorer l'app avant de s'engager
- Import depuis un autre outil : migration depuis Excel/Google Sheets

---

## 12. Micro-interactions & Polish

- Animations de stock : le nombre de stock qui "compte" visuellement quand il change (+3 : animation de 44 à 47)
- Confetti sur première sortie technicien (pas seulement onboarding)
- Couleur de fond dynamique : légère teinte rouge quand on est sur un produit critique
- Transition de page : slide/fade entre les routes au lieu du hard cut
- Pull-to-refresh sur mobile
- Skeleton plus fidèle : les skeletons actuels sont bons, ajouter un shimmer effect
- État de chargement optimiste partout : le produit apparaît instantanément dans la liste avant la confirmation serveur
- Indicateur de connexion : pastille verte/rouge si la connexion Supabase est active
- Auto-save brouillon sur les formulaires longs (création produit) — ne pas perdre le travail si on navigue accidentellement

---

## 13. Accessibilité & Ergonomie

- Navigation 100% clavier : tab order logique, focus visible sur tous les éléments interactifs
- Lecteur d'écran : aria-labels sur les icônes, les graphes, les badges de statut
- Contraste : vérifier les StatusPill (orange sur blanc est souvent insuffisant)
- Taille minimale des cibles tactiles : 44x44px partout (certains boutons ghost sont trop petits)
- Réduire le motion : respecter `prefers-reduced-motion` partout (déjà partiellement fait)
- Mode daltonien : ne pas reposer uniquement sur rouge/vert — ajouter des icônes/patterns

---

## 14. Performance & Fiabilité

- Pagination ou virtualisation : charger 1000 produits d'un coup ne scale pas — react-window ou TanStack Virtual
- Cache intelligent : stale-while-revalidate avec des TTL adaptés par type de donnée
- Prefetch : quand on hover un produit dans la liste, prefetch sa fiche détail
- Optimistic updates partout : certaines mutations attendent encore la réponse serveur
- Error boundaries par section : un widget en erreur ne crashe pas toute la page
- Retry automatique avec backoff sur les requêtes réseau échouées

---

## 15. Quick wins (impact fort, effort faible)

Les idées à attaquer en premier — gros retour sur investissement.

1. **Command palette `Cmd+K`** — game changer pour la navigation power-user
2. **Badges critiques dans la sidebar** — visibilité immédiate des urgences
3. **Breadcrumbs** — orientation instantanée
4. **Boutons quantité x5 / x10** — gain de temps énorme sur les grosses entrées
5. **Débloquer les pages sur mobile** (au moins en lecture) — les admins terrain sont frustrés
6. **Monter TechnicianEvolution** — le code est déjà écrit, juste à brancher
7. **Recherche par ref facture** dans les mouvements — demandé par tout comptable
8. **Dupliquer un produit** — 2 lignes de code, énorme gain de temps
9. **Import CSV** — le frein #1 à l'adoption c'est la saisie initiale
10. **Pull-to-refresh mobile** — attendu par tout utilisateur mobile
