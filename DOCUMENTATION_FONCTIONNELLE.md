# Documentation fonctionnelle - iStock

**Version** : 0.1
**Date** : 20 février 2026
**Statut** : Application en cours de développement (certaines fonctionnalités non implémentées)

---

## Table des matières

1. [Vue d'ensemble du produit](#1-vue-densemble-du-produit)
2. [Rôles et permissions](#2-rôles-et-permissions)
3. [Modules fonctionnels](#3-modules-fonctionnels)
4. [Flux transversaux](#4-flux-transversaux)
5. [Règles métier critiques](#5-règles-métier-critiques)
6. [Intégrations externes](#6-intégrations-externes)
7. [Fonctionnalités non implémentées ou incomplètes](#7-fonctionnalités-non-implémentées-ou-incomplètes)
8. [Glossaire](#8-glossaire)

---

## 1. Vue d'ensemble du produit

### 1.1 Qu'est-ce qu'iStock ?

iStock est un logiciel de gestion de stock multi-entreprises destiné aux organisations qui emploient des techniciens itinérants. Il permet de :

- **Suivre le stock central** de produits avec des seuils d'alerte (minimum et maximum)
- **Gérer l'inventaire des techniciens** sur le terrain : chaque technicien possède un "camion" virtuel contenant les produits qui lui ont été attribués
- **Enregistrer tous les mouvements de stock** (entrées, sorties vers technicien, sorties anonymes, pertes)
- **Piloter l'activité via un tableau de bord** avec indicateurs, graphiques et alertes
- **Scanner des QR codes** pour accélérer les opérations de mouvement de stock sur mobile

### 1.2 Architecture multi-entreprise

iStock fonctionne en mode **multi-tenant** : un même utilisateur peut appartenir à plusieurs organisations et basculer de l'une à l'autre sans se déconnecter. Chaque organisation possède ses propres données (produits, techniciens, catégories, mouvements) totalement isolées des autres.

L'organisation active est mémorisée dans le navigateur. Lorsqu'un utilisateur change d'organisation, toutes les données affichées sont rechargées pour refléter la nouvelle organisation.

### 1.3 Utilisateurs cibles

- **Gestionnaires de stock** : suivent le stock central, enregistrent les entrées, identifient les produits à réapprovisionner
- **Responsables d'équipe** : gèrent les techniciens, leur attribuent du matériel, suivent la couverture en stock de chaque technicien
- **Administrateurs** : configurent l'organisation, invitent de nouveaux membres, gèrent les rôles et les catégories de produits

### 1.4 Parcours d'accès principal

1. L'utilisateur se connecte (ou s'inscrit)
2. S'il n'a aucune organisation, il est guidé par un assistant de première configuration (onboarding)
3. Une fois dans une organisation, il accède au tableau de bord central
4. Il navigue via un menu latéral vers les différentes sections : produits, techniciens, flux de stock, paramètres

---

## 2. Rôles et permissions

### 2.1 Les trois rôles

iStock définit trois rôles au sein de chaque organisation. Un même utilisateur peut avoir des rôles différents dans différentes organisations.

| Rôle | Description |
|------|-------------|
| **Propriétaire** (owner) | Créateur de l'organisation. Dispose de tous les droits, y compris la suppression de l'organisation. |
| **Administrateur** (admin) | Peut inviter des membres et gérer l'équipe, mais ne peut pas supprimer l'organisation ni promouvoir d'autres administrateurs. |
| **Membre** (member) | Accède aux fonctionnalités courantes (consultation, mouvements de stock) mais ne peut pas gérer l'équipe ni les invitations. |

### 2.2 Matrice des permissions

| Action | Propriétaire | Administrateur | Membre |
|--------|:---:|:---:|:---:|
| Consulter le tableau de bord | Oui | Oui | Oui |
| Consulter les produits | Oui | Oui | Oui |
| Créer / modifier / archiver un produit | Oui | Oui | Oui |
| Enregistrer un mouvement de stock | Oui | Oui | Oui |
| Consulter les techniciens | Oui | Oui | Oui |
| Créer / modifier / archiver un technicien | Oui | Oui | Oui |
| Restocker un technicien | Oui | Oui | Oui |
| Gérer les catégories | Oui | Oui | Oui |
| Inviter un nouveau membre | Oui | Oui | Non |
| Modifier le rôle d'un membre | Oui | Oui | Non |
| Retirer un membre | Oui | Oui | Non |
| Promouvoir un membre en administrateur | Oui | Non | Non |
| Modifier les informations de l'organisation | Oui | Oui | Oui |
| Supprimer l'organisation | Oui | Non | Non |

> **Ambiguïté identifiée** : La modification des informations de l'organisation (nom, slug, logo) ne semble pas restreinte par rôle dans le code. Tout membre peut potentiellement modifier ces informations. Il est probable que cela soit un oubli et que seuls les propriétaires et administrateurs devraient y avoir accès.

> **Ambiguïté identifiée** : Les opérations de création, modification et archivage sur les produits et techniciens ne comportent aucune restriction par rôle dans le code actuel. Un simple membre a les mêmes capacités qu'un administrateur pour ces entités.

### 2.3 Propriétaire unique

Chaque organisation a exactement un propriétaire, celui qui l'a créée. Le rôle de propriétaire ne peut pas être transféré à un autre membre via l'interface. Un propriétaire ne peut pas modifier son propre rôle.

> **Limitation identifiée** : Il n'existe aucun mécanisme pour transférer la propriété d'une organisation. Si le propriétaire quitte l'entreprise ou perd l'accès à son compte, l'organisation ne peut plus être supprimée.

---

## 3. Modules fonctionnels

### 3.1 Module Authentification

#### 3.1.1 Inscription

L'utilisateur crée un compte en fournissant :
- Son prénom (minimum 2 caractères)
- Son nom de famille (minimum 2 caractères)
- Son adresse email
- Un mot de passe (minimum 6 caractères)

Après l'inscription, un email de confirmation est envoyé. L'utilisateur doit cliquer sur le lien de confirmation avant de pouvoir se connecter. Le lien de confirmation redirige vers un callback d'authentification qui crée la session et envoie l'utilisateur vers le tableau de bord.

#### 3.1.2 Connexion

L'utilisateur se connecte avec son email et son mot de passe. Après une connexion réussie, il est redirigé vers le tableau de bord (ou vers la page qu'il tentait d'atteindre avant d'être redirigé vers la connexion).

#### 3.1.3 Mot de passe oublié

Le flux de réinitialisation du mot de passe se déroule en deux étapes :

1. **Demande** (`/forgot-password`) : l'utilisateur saisit son adresse email. Un email contenant un lien de réinitialisation est envoyé. Par mesure de sécurité, le message affiché ("Si un compte existe avec cette adresse email...") ne révèle pas si l'email est enregistré ou non.

2. **Réinitialisation** (`/reset-password`) : l'utilisateur arrive sur cette page via le lien reçu par email. Il saisit son nouveau mot de passe (minimum 6 caractères) et le confirme. Après validation, il est redirigé vers la page de connexion.

#### 3.1.4 Gestion du profil

L'application dispose d'une page "Mon Compte" (`/users/inventory`) permettant à l'utilisateur de :

- **Modifier ses informations personnelles** : prénom et nom de famille. L'adresse email est affichée mais non modifiable.
- **Changer son mot de passe** : saisie du nouveau mot de passe avec confirmation (minimum 6 caractères).

#### 3.1.5 Déconnexion

L'utilisateur peut se déconnecter via le menu utilisateur dans l'en-tête de l'application. La déconnexion efface la session et redirige vers la page de connexion.

#### 3.1.6 Pages d'erreur

L'application dispose de pages d'erreur dédiées :
- **Page 404** : affichée lorsqu'une page n'existe pas, avec un bouton de retour à l'accueil
- **Page 500** : affichée en cas d'erreur serveur, avec un bouton de retour à l'accueil

---

### 3.2 Module Onboarding (Assistant de première configuration)

Lorsqu'un utilisateur connecté ne fait partie d'aucune organisation, il est automatiquement redirigé vers un assistant de configuration en 7 étapes. Une **barre de progression** avec indicateur de pourcentage et pastilles d'avancement est visible sur les étapes 2 à 6.

| Étape | Nom | Description | Optionnelle |
|-------|-----|-------------|:-----------:|
| 1 | **Bienvenue** | Écran d'accueil présentant les 3 fonctionnalités clés (Gestion de stock, Suivi techniciens, Analyses) et le plan de configuration en 4 points. Badge "5 min" indiquant le temps estimé. | Non |
| 2 | **Créer une organisation** | L'utilisateur saisit le nom de son organisation (min 2 caractères) et sélectionne un ou plusieurs **secteurs d'activité** parmi 6 choix illustrés avec emojis : Peinture, Revêtement, Bâtiment, Automobile, Industrie, Autre. Le slug est auto-généré. L'organisation est créée immédiatement en base de données. | Non |
| 3 | **Créer des catégories** | L'application propose **24 catégories prédéfinies** illustrées (Peintures intérieures, Enduits, Vernis, Diluants, Pinceaux, EPI, etc.) que l'utilisateur peut sélectionner en un clic. Il peut aussi ajouter des catégories personnalisées via un champ de saisie. Les catégories sont créées en base une par une avec indicateur de progression (coche verte). | Oui ("Passer cette étape") |
| 4 | **Créer des produits** | L'utilisateur ajoute des produits via un dialogue comportant : nom (obligatoire), catégorie (parmi celles créées à l'étape 3), stock initial, stock min, stock max, prix unitaire. Chaque produit ajouté est listée avec possibilité de modifier ou supprimer avant l'enregistrement final. Si un stock initial > 0 est renseigné, un mouvement d'entrée est automatiquement créé. | Oui |
| 5 | **Créer un technicien** | L'utilisateur saisit : prénom (obligatoire, min 2 car.), nom (obligatoire, min 2 car.), email (optionnel), ville/zone (optionnel). Un encadré explicatif détaille le fonctionnement en 4 points. | Oui |
| 6 | **Tutoriel stock** | Explication visuelle des 4 types de mouvements : Entrée de stock (vert), Sortie vers technicien (bleu), Sortie anonyme (orange), Restock technicien (violet). Chaque type est illustré avec un exemple concret. | Non |
| 7 | **Terminé** | Animation de confettis. Récapitulatif de tout ce qui a été créé (organisation, catégories, produits, technicien) avec indicateurs vert/gris. 3 boutons de navigation : Voir le dashboard, Ajouter des produits, Gérer les techniciens. La progression est sauvegardée en base de données (table `onboarding_progress`). | Non |

L'état de progression de l'onboarding est sauvegardé localement dans le navigateur via un store Zustand persisté. Si l'utilisateur ferme la page et revient, il reprend là où il s'était arrêté. Les identifiants des entités créées pendant l'onboarding (organisation, catégories, produits, technicien) sont mémorisés pour le récapitulatif final.

> **Comportement notable** : L'onboarding ne se déclenche que si l'utilisateur n'a aucune organisation. Un utilisateur invité dans une organisation existante ne verra jamais l'onboarding.

---

### 3.3 Module Tableau de bord

Le tableau de bord est la page d'accueil de l'application une fois connecté. Il fournit une vue synthétique de l'état du stock et de l'activité. L'interface est organisée en **3 zones** avec une navigation par **onglets** et un comportement **responsive** adapté mobile/desktop.

**En-tête du tableau de bord** : titre "Tableau de bord", sous-titre "Vue d'ensemble de votre gestion de stock", et un **bouton "Restocker un technicien"** (mis en avant, taille large) qui ouvre un flux en deux étapes : d'abord un **sélecteur de technicien** (palette de recherche par nom, email ou ville), puis le **formulaire de restock** identique à celui de la fiche technicien (voir section 3.8.2).

#### 3.3.1 Score de santé (Health Score)

En haut du tableau de bord, une carte affiche le **score de santé global** de l'organisation, de 0 à 100 points. Ce score est calculé côté base de données en appliquant des **pénalités** à partir d'un score initial de 100 (voir section 5.7 pour le détail de l'algorithme).

**Sur desktop** : un panneau à gauche affiche le score en grand (ex : "82/100"), une barre de progression colorée selon la zone (vert ≥ 70, orange ≥ 40, rouge < 40), un libellé descriptif (ex : "Quelques points d'attention"), la tendance en points par rapport au mois précédent (ex : "+5 pts"), et les 3 principales pénalités. Les 4 cartes KPI sont affichées à droite.

**Sur mobile** : une version compacte affiche le score, la tendance et le libellé avec la barre de progression. Les cartes KPI sont en dessous.

#### 3.3.2 Indicateurs clés (KPI)

Quatre cartes KPI sont affichées en grille (2×2 sur mobile, 4 colonnes sur desktop) :

| Indicateur | Description |
|------------|-------------|
| **Stock actuel** | Quantité totale en stock, avec badge de tendance (↑/↓/→ + %) vs mois précédent |
| **Valeur totale** | Valeur en euros du stock, avec badge de tendance |
| **Entrées (mois)** | Unités entrées ce mois (fond vert, préfixe "+") |
| **Sorties (mois)** | Unités sorties ce mois (fond rose, préfixe "-") |

Les badges de tendance comparent les valeurs actuelles à celles du mois précédent. Le stock du mois précédent est reconstitué par rétro-calcul (stock actuel + sorties du mois - entrées du mois). Ces statistiques sont calculées en une seule opération côté base de données via le RPC `get_health_score`.

#### 3.3.3 Navigation par onglets

Le contenu principal du tableau de bord est organisé en **4 onglets** dans une carte. Sur petit écran, les libellés sont abrégés (Vue, Prod., Tech., Flux).

| Onglet | Contenu |
|--------|---------|
| **Aperçu** | Graphiques d'évolution du score et des flux (onglet par défaut) |
| **Produits** | Tableau des produits à risque |
| **Techniciens** | Tableau de tous les techniciens avec statut |
| **Flux** | Tableau des 20 derniers mouvements de stock |

#### 3.3.4 Onglet Aperçu

Cet onglet contient deux graphiques empilés :

**Graphique principal — Évolution du score (Area Chart) :**
- Affiche le **score de santé global** sur les **6 derniers mois** sous forme de courbe en aires
- Trois bandes de couleur horizontales en arrière-plan : rouge (0-40), orange (40-70), vert (70-100)
- **Filtre par catégorie** : menu déroulant pour restreindre les produits
- **Sélection multi-produits** : popover de recherche permettant de sélectionner jusqu'à **6 produits** individuels par nom ou SKU. Lorsque des produits sont sélectionnés, le graphique bascule du score global vers les **scores de stock individuels** de chaque produit, affichés comme des courbes colorées distinctes. Les produits sélectionnés apparaissent comme des badges amovibles sous les filtres
- Un bouton "Effacer la sélection" permet de revenir à la vue globale
- Un overlay de chargement s'affiche pendant le chargement des données par produit

**Graphique secondaire — Flux mensuels (Bar Chart) :**
- Visible uniquement en **vue globale** (masqué quand des produits sont sélectionnés)
- Barres vertes pour les entrées, barres rouges pour les sorties, mois par mois

Le calcul du score historique est effectué côté base de données : pour chaque mois passé, le stock de chaque produit est reconstitué en annulant les mouvements postérieurs, puis les 6 règles de pénalité sont appliquées.

#### 3.3.5 Onglet Produits

Un tableau liste les **produits à risque** (score de stock inférieur à 60%), triés par score croissant (les pires en premier) :

| Colonne | Description |
|---------|-------------|
| **Produit** | Image, nom et SKU |
| **Stock** | Quantité actuelle (triable) |
| **Min / Max** | Seuils configurés |
| **Score** | Barre de progression colorée + pourcentage (triable) |
| **Dernier mouvement** | Date relative en français (ex : "il y a 3 jours") |

Chaque ligne est cliquable et redirige vers la fiche produit (`/product/{id}`).

**État vide** : si tous les produits ont un score ≥ 60%, un message vert "Tous les produits sont en bon état" s'affiche.

#### 3.3.6 Onglet Techniciens

Un tableau liste **tous les techniciens actifs** (non archivés) de l'organisation :

| Colonne | Description |
|---------|-------------|
| **Technicien** | Avatar avec initiales + nom complet |
| **Articles** | Nombre de produits distincts + quantité totale |
| **Dernier restock** | Date relative, colorée : rouge si > 14 jours ou jamais, orange si > 7 jours |
| **Couverture** | Pourcentage moyen de couverture (quantité / stock_max par produit), orange si < 50% |
| **Action** | Bouton "Restocker" qui ouvre directement le formulaire de restock sans quitter le tableau de bord |

Les colonnes Articles, Dernier restock et Couverture sont **triables**. Le tri par défaut place les techniciens jamais restockés en premier, puis ceux avec le restock le plus ancien.

Un clic sur le nom du technicien redirige vers sa fiche (`/users/{id}`).

#### 3.3.7 Onglet Flux

Un tableau affiche les **20 derniers mouvements de stock** :

| Colonne | Description |
|---------|-------------|
| **Produit** | Image + nom du produit |
| **Type** | Badge coloré : "Entrée" (vert), "Sortie tech." (bleu), "Sortie anon." (gris), "Perte" (rouge) |
| **Quantité** | Avec signe et couleur : vert "+N" pour les entrées, rouge "-N" pour les sorties |
| **Technicien** | Nom du technicien (pour les sorties technicien) ou "-" |
| **Date** | Date formatée en français |

**Filtre par type** : un menu déroulant permet de filtrer par "Tous", "Entrées", "Sorties tech.", "Sorties anon.", "Pertes".

Chaque ligne est cliquable et redirige vers la fiche détaillée du mouvement (`/orders/{id}`).

Un bouton "Voir tout l'historique" en bas redirige vers la page complète des flux (`/orders`).

#### 3.3.8 Liste des tâches à faire (Action Task List)

Une liste de **tâches prioritaires** générées automatiquement est affichée à côté des onglets. Les tâches sont calculées côté base de données via le RPC `get_dashboard_tasks` et regroupées par catégorie :

| Catégorie | Priorité | Condition |
|-----------|----------|-----------|
| **Ruptures de stock** | Critique (score 1000) | Produits avec stock = 0 |
| **Stock faible** | Important (score 500+) | Produits avec 0 < stock ≤ stock_min |
| **Surstockage** | Important (score 300) | Produits avec stock ≥ 2 × stock_max |
| **Techniciens jamais restockés** | Critique (score 900) | Aucun historique d'inventaire |
| **Techniciens à restocker** | Important (score 600+) | Dernier restock > 7 jours |
| **Produits dormants** | Informatif (score 100) | Aucun mouvement depuis 60 jours |

Chaque tâche affiche une bordure colorée à gauche (rouge = critique, orange = important, gris = informatif), une icône teintée et un résumé cliquable qui redirige vers la page concernée. Un badge rouge sur l'en-tête indique le nombre total de tâches.

**Regroupement** : si plus de 3 tâches du même type existent, elles sont agrégées en une seule tâche groupée (ex : "5 produits en rupture de stock") avec un lien vers la liste filtrée.

**Masquage** : chaque tâche peut être masquée (bouton ×, visible au survol) pour **24 heures**. Les masquages sont stockés localement dans le navigateur via un store Zustand persisté. Les masquages expirés sont automatiquement nettoyés.

**Limite d'affichage** : les 5 premières tâches sont visibles par défaut, avec un lien "Voir les N autres tâches" pour afficher le reste.

**État vide** : quand toutes les tâches sont résolues, un bandeau vert "Tout est en ordre" s'affiche.

#### 3.3.9 Disposition responsive

**Desktop (≥ 1024px)** : disposition en deux colonnes :
- **Colonne gauche** (principale) : Score de santé + KPI, puis onglets avec leur contenu
- **Colonne droite** (320px, sticky) : Liste des tâches à faire

**Mobile (< 1024px)** : disposition en une seule colonne :
1. Score de santé compact + KPI
2. Onglets (libellés abrégés)
3. Un **bouton flottant** (FAB) en bas à droite affiche un badge rouge avec le nombre de tâches. Un tap ouvre un **tiroir latéral droit** (Sheet) contenant la liste des tâches. Ce tiroir se ferme automatiquement lors d'un changement de page. Le FAB est positionné au-dessus du bouton de scan QR code pour éviter le chevauchement.

---

### 3.4 Module Produits

#### 3.4.1 Liste des produits

La page des produits affiche la liste de tous les produits de l'organisation active, avec :
- Image du produit (si disponible)
- Nom du produit
- Référence SKU (si renseignée)
- Catégorie (si assignée)
- Stock actuel / Stock maximum
- Score de stock (indicateur visuel avec code couleur)
- Prix unitaire (si renseigné)

**Fonctionnalités de la liste :**
- **Recherche textuelle** : par nom ou SKU
- **Filtrage par catégorie** : y compris les sous-catégories
- **Filtrage par statut de stock** : Tous, En alerte (score < 30%), Bon stock (score >= 30%)
- **Tri** : par nom, stock actuel, date de création
- **Pagination** : 20 produits par page par défaut

**Statistiques en haut de page :**
- Nombre total de produits
- Nombre de produits en alerte
- Valeur totale du stock
- Stock total (somme de toutes les quantités)

**Export CSV** : La liste des produits peut être exportée en fichier CSV. Le fichier est encodé en UTF-8 avec BOM pour une compatibilité optimale avec Microsoft Excel en français (gestion correcte des accents et caractères spéciaux).

#### 3.4.2 Création d'un produit

Le formulaire de création est organisé en plusieurs sections (cards) :

**Section "Détails du produit" :**

| Champ | Obligatoire | Description | Valeur par défaut |
|-------|:-----------:|-------------|-------------------|
| Nom | Oui (min 2 caractères) | Nom du produit | - |
| Prix unitaire (€) | Non | Prix d'une unité du produit | - |
| Description | Non | Description libre du produit | - |

**Section "Image du produit" :**

L'image peut être ajoutée par **glisser-déposer** (drag & drop) ou en cliquant sur "Sélectionner une image". Formats acceptés : PNG et JPG. Taille maximale : 5 Mo. Un aperçu de l'image s'affiche avant la soumission.

**Section "Fournisseur" :**

| Champ | Obligatoire | Description |
|-------|:-----------:|-------------|
| Nom du fournisseur | Non | Nom du fournisseur habituel pour ce produit |

**Section "Niveau de stock" :**

| Champ | Obligatoire | Description | Valeur par défaut |
|-------|:-----------:|-------------|-------------------|
| Stock actuel | Non | Quantité en stock au moment de la création | 0 |
| Niveau de stock optimum | Non | Niveau de stock considéré comme optimal | 100 |
| Niveau critique (minimum) | Non | Seuil en dessous duquel le produit est considéré en alerte | 10 |
| Ce produit est périssable | Non | Case à cocher indiquant si le produit est périssable | Non coché |
| Activer le suivi du stock | Non | Interrupteur permettant de désactiver le suivi de stock pour ce produit | Activé |

**Section "Catégorie" :**

| Champ | Obligatoire | Description |
|-------|:-----------:|-------------|
| Catégorie | Non | Catégorie à laquelle le produit est rattaché. Un bouton "+" permet de **créer une nouvelle catégorie** directement depuis ce formulaire sans quitter la page. |

> **Note** : Le champ SKU n'est pas visible sur le formulaire de création/modification. Si non renseigné, un SKU est **généré automatiquement** à partir des 3 premières lettres du nom en majuscules suivies de 4 chiffres aléatoires (ex : "VIS-3847").

> **Règle métier** : Si un stock initial est renseigné lors de la création, un mouvement d'entrée est automatiquement enregistré dans l'historique des flux.

#### 3.4.3 Fiche produit détaillée

La fiche d'un produit affiche :

- **En-tête** : nom, SKU, catégorie, image, prix
- **4 indicateurs compacts** : Prix unitaire, Niveau (score %), Stock actuel, Valeur (prix × quantité)
- **Alerte visuelle** : si le stock est inférieur ou égal au minimum, un bandeau rouge s'affiche avec le message "Rupture de stock ! Réapprovisionnement urgent." (stock = 0) ou "Stock bas ! Le niveau minimum est atteint." (stock > 0 mais <= min)
- **Barre de progression** du stock avec les seuils min et max, code couleur, et statut textuel (Critique, Bas, Attention, Bon, Optimal)
- **Tableau d'informations** : catégorie, fournisseur, périssable (oui/non), suivi stock (actif/désactivé)
- **QR Code** : un QR code unique est généré pour chaque produit (voir section 3.8). Affiché dans la colonne de gauche sur grand écran, en bas de page sur mobile.
- **Graphique d'évolution** : graphique en aires montrant les entrées et sorties des **3 derniers mois** (par jour), avec un résumé chiffré : total entrées, total sorties, balance nette
- **Actions en haut de page** : Restocker (ouvre le formulaire de mouvement de stock pré-rempli), Modifier, Archiver (avec confirmation)

#### 3.4.4 Modification d'un produit

Tous les champs renseignés à la création sont modifiables. La modification du stock actuel ne se fait pas par cette interface, mais exclusivement via les mouvements de stock (entrée ou sortie).

#### 3.4.5 Archivage d'un produit

L'archivage d'un produit est un **soft delete** : le produit n'est pas supprimé de la base de données mais marqué avec une date d'archivage (`archived_at`). Un produit archivé **n'apparaît plus** dans les listes, les statistiques, ni les sélecteurs (restock, mouvements).

Une **boîte de dialogue de confirmation** s'affiche avec le message : "[nom du produit] sera archivé et ne sera plus visible dans les listes et statistiques."

L'archivage peut être déclenché depuis :
- La fiche produit (bouton "Archiver")
- Le menu contextuel de la liste des produits (menu "..." > Archiver)

Les mouvements de stock et données historiques associés au produit sont **conservés**.

#### 3.4.6 Actions contextuelles sur la liste des produits

Chaque ligne de la liste de produits dispose d'un menu contextuel (icône "...") avec les actions suivantes :
- **Restocker** : ouvre le formulaire de mouvement de stock pré-rempli avec ce produit
- **Voir détails** : redirige vers la fiche produit
- **Modifier** : redirige vers le formulaire d'édition
- **Copier l'ID** : copie l'identifiant technique du produit dans le presse-papiers
- **Archiver** : ouvre la confirmation d'archivage

De plus, la liste propose :
- **Sélection multiple** : cases à cocher sur chaque ligne (la fonctionnalité d'action groupée n'est pas implémentée, seule la sélection visuelle existe)
- **Masquer/afficher des colonnes** : bouton "Colonnes" permettant de choisir quelles colonnes sont visibles (Produit, Prix, Catégorie, Stock, Statut)

---

### 3.5 Module Catégories

#### 3.5.1 Fonctionnement hiérarchique

Les catégories organisent les produits en arborescence. Chaque catégorie peut avoir :
- Un **nom** (obligatoire, minimum 2 caractères)
- Une **catégorie parente** (optionnelle) : si renseignée, la catégorie devient une sous-catégorie de la catégorie parente

Il n'y a pas de limite de profondeur dans l'arborescence.

**Exemple de hiérarchie :**
```
Outillage
├── Visserie
│   ├── Vis à bois
│   └── Vis métal
├── Boulonnerie
Électricité
├── Câbles
└── Connecteurs
```

#### 3.5.2 Opérations sur les catégories

| Opération | Comportement |
|-----------|-------------|
| **Créer** | Saisir un nom et éventuellement sélectionner une catégorie parente |
| **Modifier** | Changer le nom ou la catégorie parente |
| **Supprimer** | Possible uniquement si la catégorie n'a **aucune sous-catégorie**. Les produits de cette catégorie ne sont pas supprimés, ils deviennent "sans catégorie". |

> **Règle métier** : Une catégorie qui contient des sous-catégories ne peut pas être supprimée. Il faut d'abord supprimer ou déplacer toutes ses sous-catégories.

> **Ambiguïté identifiée** : Aucune vérification ne semble empêcher la suppression d'une catégorie qui contient directement des produits. Les produits deviennent simplement orphelins (sans catégorie). Ce comportement mériterait un avertissement à l'utilisateur.

---

### 3.6 Module Techniciens

#### 3.6.1 Qu'est-ce qu'un technicien dans iStock ?

Un technicien dans iStock est un intervenant de terrain (artisan, installateur, réparateur, etc.) à qui l'organisation attribue du matériel depuis son stock central. Le technicien possède un **inventaire virtuel** qui représente ce qu'il a en sa possession (dans son véhicule, sa caisse à outils, etc.).

> **Important** : Un technicien n'est **pas** un utilisateur de l'application. Les techniciens ne se connectent pas à iStock. Ils sont gérés par les utilisateurs de l'application (gestionnaires, administrateurs).

#### 3.6.2 Liste des techniciens

La page affiche tous les techniciens de l'organisation avec :
- Nom et prénom
- Email
- Nombre d'articles en inventaire
- Date du dernier réapprovisionnement
- Indicateur visuel du niveau de stock

**Statistiques en haut de page :**
- Nombre total de techniciens
- Nombre de techniciens avec inventaire vide
- Nombre total d'articles distribués aux techniciens
- Nombre de restocks effectués dans les 7 derniers jours

**Navigation dynamique dans le menu latéral :** chaque technicien apparaît aussi comme un sous-élément du menu "Techniciens" dans la barre latérale, permettant un accès rapide à sa fiche.

#### 3.6.3 Création d'un technicien

| Champ | Obligatoire | Description |
|-------|:-----------:|-------------|
| Prénom | Oui (min 2 caractères) | Prénom du technicien |
| Nom | Oui (min 2 caractères) | Nom de famille |
| Email | Non (format email valide si renseigné) | Adresse email du technicien |
| Téléphone | Non | Numéro de téléphone |
| Ville | Non | Ville de rattachement |

> **Contrainte** : Si renseignée, l'adresse email doit être unique au sein de l'organisation. Deux techniciens ne peuvent pas avoir le même email.

#### 3.6.4 Fiche technicien détaillée

La fiche d'un technicien affiche :

**Informations personnelles :** nom, prénom, email, téléphone, ville, date d'inscription

**Inventaire actuel (onglet "Inventaire") :**
- Liste des produits en possession du technicien avec la quantité de chaque article
- Pourcentage de couverture par rapport au stock maximum du produit (ex : si le technicien a 3 vis sur un stock max de 10, il est couvert à 30%)
- Bouton de restock (réapprovisionnement)

**Évolution (onglet "Evolution") :**
- Graphique des mouvements de stock (`exit_technician`) des derniers mois pour ce technicien
- Permet de visualiser l'historique des attributions de produits dans le temps

**Historique des approvisionnements (onglet "Historique") :**
- Les mouvements de sortie vers le technicien sont automatiquement **regroupés en "sessions de restock"** : tous les mouvements enregistrés dans un intervalle d'une minute sont considérés comme faisant partie du même restock
- Chaque session affiche : la date et l'heure, le nombre de produits et d'items totaux, puis la liste de chaque produit avec sa quantité et son image

**Mouvements de stock (onglet "Mouvements") :**
- Historique de toutes les sorties de stock attribuées à ce technicien
- Chaque mouvement indique : le produit, la quantité, la date, et les notes éventuelles

**Actions :** modifier le technicien, archiver le technicien

#### 3.6.5 Archivage d'un technicien

L'archivage d'un technicien est un **soft delete** : le technicien n'est pas supprimé de la base de données mais marqué avec une date d'archivage (`archived_at`). Un technicien archivé **n'apparaît plus** dans les listes, les statistiques, ni les sélecteurs (restock depuis le tableau de bord).

Une **boîte de dialogue de confirmation** s'affiche avec le message : "[nom du technicien] sera archivé et ne sera plus visible dans les listes et statistiques."

L'archivage peut être déclenché depuis :
- La fiche technicien (bouton "Archiver")
- Le menu contextuel de la liste des techniciens (menu "..." > Archiver)

L'inventaire et l'historique du technicien sont **conservés** dans la base de données.

---

### 3.7 Module Mouvements de stock (Flux)

#### 3.7.1 Les quatre types de mouvement

| Type | Nom affiché | Effet sur le stock | Description |
|------|-------------|-------------------|-------------|
| `entry` | Entrée | +N au stock central | Réception de marchandise, retour fournisseur, etc. |
| `exit_technician` | Sortie technicien | -N au stock central, +N dans l'inventaire du technicien | Attribution de matériel à un technicien |
| `exit_anonymous` | Sortie anonyme | -N au stock central | Sortie sans technicien identifié |
| `exit_loss` | Perte/Casse | -N au stock central | Constat de perte, casse ou produit détérioré |

#### 3.7.2 Enregistrement d'un mouvement

Un mouvement de stock peut être enregistré depuis plusieurs endroits :
1. **La page dédiée "Mouvement de stock"** (`/stock`) : propose deux options — scanner un QR code ou accéder à la liste des produits
2. **Le formulaire rapide (QuickStockMovementModal)** : accessible depuis le bouton "Restocker" du tableau de bord, le bouton "Restocker" de chaque produit, et la page Stock après scan QR ou sélection d'un produit via URL (`?product=ID`)
3. **Le formulaire en page "Flux de stock"** : dialogue de création accessible via le bouton "Nouveau mouvement" de la page des mouvements, avec sélection intégrée du produit, direction, quantité et technicien
4. **Le scan d'un QR code** : le scan identifie le produit et ouvre le formulaire rapide pré-rempli

**Le formulaire rapide (QuickStockMovementModal) :**

Si aucun produit n'est pré-sélectionné, l'utilisateur voit d'abord un **sélecteur de produit** avec barre de recherche (par nom ou SKU), affichant pour chaque produit : image, nom, SKU et stock actuel.

Une fois le produit sélectionné, l'interface affiche :
- **Aperçu du produit** : image, nom, SKU, badge de stock actuel, prix unitaire. Un bouton "Changer" permet de resélectionner un autre produit (sauf si le produit a été imposé par URL ou QR).
- **Bascule de direction** : toggle "Entrée" (vert) / "Sortie" (rouge)
- **Type de sortie** (si sortie) : "Vers technicien", "Sortie anonyme", "Perte / Casse"
- **Sélecteur de technicien** (si sortie technicien)
- **Quantité** : champ numérique borné (max = stock disponible pour les sorties)
- **Notes** : champ texte optionnel

Le bouton de validation change de couleur selon la direction : vert "Ajouter au stock" ou rouge "Retirer du stock".

**Validation côté formulaire :**
- Pour une sortie, la quantité demandée est comparée au stock actuel du produit. Si le stock est insuffisant, le formulaire affiche le stock disponible et empêche la validation.
- Pour une sortie technicien, le technicien est obligatoire.

#### 3.7.3 Historique des mouvements (page "Flux de stock")

La page "Flux de stock" affiche l'historique complet des mouvements de stock avec :

- Le produit (nom, SKU, image)
- Le type de mouvement (avec code couleur : vert pour entrée, bleu pour sortie technicien, gris pour sortie anonyme, rouge pour perte)
- La quantité
- Le technicien (pour les sorties technicien)
- Les notes
- La date et l'heure

**Filtres disponibles :**
- Par produit
- Par technicien
- Par type de mouvement (entrée, sortie technicien, sortie anonyme, perte)
- Par période (date de début et date de fin)

**Pagination :** 20 mouvements par page

**Export CSV** : La liste des mouvements peut être exportée au format CSV (même format que les produits : UTF-8 avec BOM).

**Bouton "Nouveau mouvement"** : En haut à droite de la liste, un bouton ouvre un formulaire de création de mouvement (identique au formulaire décrit en 3.7.2).

#### 3.7.4 Indicateurs de la page Flux

En haut de la page "Flux de stock", 4 indicateurs résument l'activité des 30 derniers jours :
- **Entrées (30 jours)** : nombre total d'unités entrées en stock
- **Sorties (30 jours)** : nombre total d'unités sorties du stock
- **Balance** : différence nette (entrées - sorties), avec icône de tendance haussière ou baissière
- **Mouvements récents** : nombre total de mouvements enregistrés sur la période

#### 3.7.5 Fiche détaillée d'un mouvement

Chaque mouvement de la liste est cliquable et ouvre une **page de détail** dédiée. Le contenu diffère selon le type de mouvement :

**Pour une entrée (`/orders/income/[id]`) :**
- Date et heure du mouvement (format complet en français)
- Nom du fournisseur (issu de la fiche produit)
- Notes éventuelles
- Résumé : quantité entrée, prix unitaire, valeur totale calculée
- Tableau du produit réapprovisionné avec image, nom, SKU, quantité, prix
- Lien vers la fiche produit

**Pour une sortie (`/orders/outcome/[id]`) :**
- Date et heure du mouvement
- Type de sortie avec badge coloré (Sortie technicien / Sortie anonyme / Perte-Casse)
- Informations du technicien (nom, prénom, email) si sortie technicien, avec avatar
- Bandeau d'alerte rouge si perte/casse : "Produit marqué comme perte ou casse."
- Notes éventuelles
- Résumé : quantité sortie, prix unitaire, valeur totale
- Tableau du produit sorti avec image, nom, SKU
- Liens vers la fiche technicien et la fiche produit

#### 3.7.6 Atomicité des mouvements

Chaque mouvement de stock est exécuté de manière **atomique** dans la base de données. Cela signifie que :
- Le mouvement est enregistré ET le stock est mis à jour dans une seule opération indivisible
- Si deux personnes tentent de sortir le même stock simultanément, une seule opération réussira si le stock est insuffisant pour les deux
- Il est impossible d'avoir un mouvement enregistré sans que le stock ait été mis à jour, ou inversement

Pour une **entrée**, l'opération :
1. Vérifie que la quantité est strictement positive
2. Verrouille la ligne du produit pour éviter les accès concurrents
3. Crée l'enregistrement du mouvement
4. Incrémente le stock actuel du produit

Pour une **sortie**, l'opération :
1. Vérifie que la quantité est strictement positive
2. Vérifie que le type de sortie est valide
3. Vérifie que le technicien est renseigné (pour une sortie technicien)
4. Verrouille la ligne du produit
5. Vérifie que le stock disponible est suffisant
6. Crée l'enregistrement du mouvement
7. Décrémente le stock actuel du produit
8. Si c'est une sortie technicien : met à jour l'inventaire du technicien (ajout ou création de la ligne d'inventaire)

---

### 3.8 Module Réapprovisionnement des techniciens (Restock)

#### 3.8.1 Mode de réapprovisionnement

Le réapprovisionnement d'un technicien fonctionne en **ajout à l'inventaire existant** :

- L'inventaire actuel est sauvegardé dans l'historique (snapshot)
- Les nouveaux articles sont **ajoutés** à l'inventaire existant
- Si un produit est déjà dans l'inventaire, les quantités sont **additionnées**
- Les mouvements de stock correspondants sont créés (sorties technicien)
- Le stock central est décrémenté pour chaque produit

Ce mode permet de compléter le stock d'un technicien sans affecter le reste de son inventaire (ex : ajouter 5 câbles sans toucher aux vis qu'il a déjà).

#### 3.8.2 Interface de restock

Le restock s'effectue via une **boîte de dialogue** accessible depuis :
- La **fiche du technicien** (bouton "Restocker") — le technicien est déjà sélectionné
- Le **tableau de bord** (bouton "Restocker un technicien") — un sélecteur de technicien s'affiche d'abord, puis la même boîte de dialogue s'ouvre

**Sélection des produits :**
Un menu déroulant permet d'ajouter des produits un par un. Seuls les produits dont le stock central est supérieur à 0 sont proposés. Les produits déjà sélectionnés sont masqués du menu.

Pour chaque produit ajouté, l'interface affiche :
- Le nom, l'image, et le stock disponible dans le stock central
- Des boutons **+** et **-** pour ajuster la quantité
- Un champ numérique pour saisir directement la quantité
- Un bouton poubelle pour retirer le produit de la sélection

La quantité est bornée entre 1 et le stock disponible.

**Étape 3 : Validation**
Un récapitulatif en bas affiche le nombre de produits et le nombre total d'items. Le bouton "Valider le restock" lance l'opération.

#### 3.8.3 Historique des restocks

Chaque restock (complet ou partiel) génère une entrée dans l'historique du technicien. Cette entrée contient :
- La date du restock
- Le nombre total d'articles
- Le détail de chaque produit avec sa quantité, son nom et son SKU

Cet historique permet de retrouver l'état exact de l'inventaire du technicien à chaque moment clé.

---

### 3.9 Module QR Codes

#### 3.9.1 Génération de QR codes

Chaque produit possède un QR code unique généré automatiquement. Le QR code encode l'URL suivante :
```
https://istock-app.space/stock?product={identifiant_du_produit}
```

Le QR code peut être :
- **Téléchargé** comme image (format PNG)
- **Imprimé** directement depuis l'application

Il est affiché sur la fiche détaillée de chaque produit.

#### 3.9.2 Scan de QR codes

Le scan de QR codes est accessible via un **bouton flottant** visible uniquement sur mobile (en bas à droite de l'écran). Ce bouton active la caméra du téléphone pour scanner un QR code.

Le scanner reconnaît deux formats :
- **Format actuel** : `https://istock-app.space/stock?product={id}` — ouvre le formulaire de mouvement de stock pré-rempli avec le produit
- **Format hérité** : `smpr://product/{id}` — rétrocompatibilité avec d'anciens QR codes

Après le scan, l'utilisateur est redirigé vers la page de mouvement de stock avec le produit déjà sélectionné, prêt à enregistrer une entrée ou une sortie.

---

### 3.10 Module Organisations

#### 3.10.1 Gestion des organisations

Depuis la page "Organisations" des paramètres, un utilisateur peut :

- **Voir** toutes les organisations dont il est membre
- **Créer** une nouvelle organisation (nom, slug, logo optionnel)
- **Modifier** une organisation existante (nom, slug, logo)
- **Supprimer** une organisation (propriétaire uniquement)

**Le slug** est un identifiant court et unique utilisé dans le système. Il est auto-généré à partir du nom (minuscules, sans caractères spéciaux, tirets en séparateurs). Deux organisations ne peuvent pas avoir le même slug.

**Le logo** est une image uploadée vers un espace de stockage en ligne. Le nom du fichier est généré automatiquement pour éviter les conflits.

#### 3.10.2 Changement d'organisation active

L'utilisateur peut changer d'organisation active via :
- Le **sélecteur d'organisation** dans le menu latéral
- La page **Organisations** dans les paramètres

Lors du changement d'organisation :
1. L'organisation active est mise à jour
2. Toutes les données en mémoire sont vidées et rechargées
3. Toutes les listes et indicateurs reflètent la nouvelle organisation

#### 3.10.3 Organisation par défaut

Parmi toutes ses organisations, l'utilisateur peut en définir une comme **organisation par défaut**. C'est celle qui sera automatiquement sélectionnée à la connexion. Si aucune organisation par défaut n'est définie, la première organisation (par date de création) est utilisée.

---

### 3.11 Module Invitations et gestion d'équipe

#### 3.11.1 Inviter un membre

Un propriétaire ou administrateur peut inviter un nouvel utilisateur à rejoindre l'organisation en fournissant :
- L'adresse email de la personne à inviter
- Le rôle à attribuer : **Administrateur** ou **Membre** (pas Propriétaire)

L'invitation génère un lien unique contenant un jeton (token). Ce lien a une date d'expiration.

> **Contraintes** :
> - On ne peut pas envoyer deux invitations à la même adresse email pour la même organisation
> - L'email de l'invitation doit correspondre exactement à l'email du compte qui accepte l'invitation

> **Ambiguïté identifiée** : Le mécanisme d'envoi effectif de l'email d'invitation n'est pas visible dans le code applicatif. Il est probable que cette fonctionnalité repose sur un déclencheur côté base de données ou service email externe, mais ce point n'est pas vérifié. L'invitation est créée en base de données et un lien est généré, mais la livraison de l'email à l'utilisateur invité n'est pas garantie par le code de l'application.

#### 3.11.2 Accepter une invitation

Lorsqu'un utilisateur clique sur le lien d'invitation :
1. L'application vérifie que l'invitation est toujours valide (non expirée, non déjà acceptée)
2. L'utilisateur doit être connecté (ou se connecter/s'inscrire)
3. L'adresse email du compte connecté doit correspondre à l'email de l'invitation
4. L'utilisateur est ajouté à l'organisation avec le rôle prévu
5. L'invitation est marquée comme acceptée

Si l'email ne correspond pas, l'acceptation est refusée avec le message : "Cette invitation est destinée à une autre adresse email".

#### 3.11.3 Gestion des membres

Depuis la page "Équipe" des paramètres :

| Action | Qui peut la faire | Détail |
|--------|-------------------|--------|
| Voir la liste des membres | Tous | Affiche l'email, le rôle et la date d'arrivée de chaque membre |
| Changer le rôle d'un membre | Propriétaire, Administrateur | Bascule entre Administrateur et Membre. Le rôle Propriétaire ne peut pas être attribué. |
| Retirer un membre | Propriétaire, Administrateur | Supprime le lien entre l'utilisateur et l'organisation. L'utilisateur ne peut plus accéder aux données. |
| Voir les invitations en attente | Propriétaire, Administrateur | Liste des invitations envoyées mais pas encore acceptées |
| Annuler une invitation | Propriétaire, Administrateur | Supprime l'invitation (le lien ne fonctionnera plus) |

> **Limitation** : Un administrateur peut retirer un autre administrateur. Seul le propriétaire ne peut pas être retiré. Il n'y a pas de protection empêchant un administrateur de retirer tous les autres administrateurs.

---

### 3.12 Module Recherche et navigation rapide

L'application dispose d'une barre de recherche accessible depuis l'en-tête. Elle utilise un raccourci clavier (**Ctrl+K** ou **Cmd+K**) pour un accès rapide. Sur mobile, un bouton loupe remplace la barre de recherche.

La recherche ouvre une **palette de commande** (command palette) qui permet de rechercher et naviguer vers :

**Groupe "Produits"** (recherche dynamique) :
- Recherche **côté serveur** déclenchée à partir de 2 caractères, avec debounce de 300ms
- Affiche jusqu'à 5 résultats avec icône, nom du produit et SKU
- Un clic navigue directement vers la fiche produit (`/product/{id}`)
- Un spinner s'affiche pendant le chargement

**Groupe "Techniciens"** (recherche dynamique) :
- La liste complète des techniciens est pré-chargée à l'ouverture de la palette
- Le filtrage est effectué **côté client** nativement par cmdk (sur prénom, nom et email)
- Chaque résultat affiche le nom complet et la ville
- Un clic navigue directement vers la fiche technicien (`/users/{id}`)

**Pages statiques :**
- **Groupe "Stock"** : Vue d'ensemble, Stock produits, Catégories, Techniciens, Flux de stock
- **Groupe "Configuration"** : Équipe, Organisations, Paramètres

La palette remet à zéro la recherche à sa fermeture.

---

### 3.13 Thème clair / sombre

L'application supporte un **mode clair** et un **mode sombre**. Un bouton de bascule (icône soleil/lune) est disponible :
- Sur les pages publiques (connexion, inscription, mot de passe oublié) : en haut à droite
- Sur les pages protégées : dans l'en-tête de l'application, entre la barre de recherche et l'avatar utilisateur

Le choix du thème est mémorisé dans le navigateur.

---

### 3.14 En-tête et menu utilisateur

#### 3.14.1 En-tête de l'application

L'en-tête (barre supérieure) est fixe et contient, de gauche à droite :
- **Bouton menu** : affiche/masque la barre latérale (visible sur mobile et desktop)
- **Barre de recherche** : palette de commande (voir section 3.12)
- **Bouton thème** : bascule clair/sombre
- **Avatar utilisateur** : ouvre le menu utilisateur

#### 3.14.2 Menu utilisateur

Un clic sur l'avatar ouvre un menu déroulant affichant :
- **En-tête** : avatar avec initiales, nom complet (ou prénom du compte), adresse email
- **Mon Compte** : redirige vers la page de profil (`/users/inventory`)
- **Notifications** : élément de menu présent mais non fonctionnel (aucune action)
- **Se déconnecter** : ferme la session et redirige vers la page de connexion

Les initiales de l'avatar sont calculées à partir du nom complet (première lettre du prénom + première lettre du nom). Si le nom n'est pas renseigné, les deux premières lettres de l'email sont utilisées.

---

### 3.15 Barre latérale (Sidebar)

La barre latérale est le principal moyen de navigation dans l'application.

#### 3.15.1 Sélecteur d'organisation

En haut de la barre latérale, un bouton affiche le **logo** (ou initiales) et le **nom** de l'organisation active. Un clic ouvre un menu déroulant listant toutes les organisations de l'utilisateur, avec une coche à côté de l'organisation active. Un clic sur une autre organisation déclenche le changement d'organisation (voir section 3.10.2).

#### 3.15.2 Navigation

Le menu est organisé en groupes (selon la configuration des routes) :
- **Groupe "Stock"** : Vue d'ensemble (tableau de bord), Stock produits, Catégories, Techniciens (avec sous-menu dynamique), Flux de stock
- **Groupe "Configuration"** : Équipe, Organisations, Paramètres

Certains éléments de menu peuvent porter des badges : "Coming" (grisé) pour les fonctionnalités à venir, "New" (vert) pour les nouveautés.

#### 3.15.3 Menu dynamique des techniciens

Le menu "Techniciens" est spécial : il est **collapsible** et liste dynamiquement tous les techniciens de l'organisation. Chaque technicien apparaît comme un sous-élément cliquable redirigeant directement vers sa fiche. En mode "icônes seulement", un menu déroulant secondaire affiche la liste avec défilement.

#### 3.15.4 Comportement responsive

- La barre latérale est **collapsible** en mode icônes uniquement (affiche seulement les icônes, avec infobulles au survol)
- Sur **tablette**, elle se replie automatiquement en mode icônes
- Sur **mobile**, elle se ferme automatiquement à chaque changement de page
- Un bouton dans l'en-tête permet de l'afficher/masquer manuellement

---

### 3.16 Module Paramètres

La page "Paramètres" générale est actuellement un **placeholder** affichant un message "Bientôt disponible". Les paramètres fonctionnels sont accessibles via les sous-pages :
- **Catégories** : gestion de l'arborescence des catégories (voir section 3.5)
- **Équipe** : gestion des membres et invitations (voir section 3.11)
- **Organisations** : gestion des organisations (voir section 3.10)

---

## 4. Flux transversaux

### 4.1 Flux : Réception de marchandise (entrée de stock)

**Contexte** : L'entreprise reçoit un colis de son fournisseur et doit mettre à jour le stock.

1. L'utilisateur accède à la page "Stock" (ou clique sur le bouton d'action rapide)
2. Il sélectionne le produit concerné (par recherche textuelle ou scan QR code)
3. Il choisit la direction "Entrée"
4. Il saisit la quantité reçue
5. Il ajoute éventuellement une note (ex : "Commande fournisseur #1234")
6. Il valide le mouvement
7. Le stock central du produit est immédiatement augmenté
8. Le mouvement apparaît dans l'historique des flux

### 4.2 Flux : Équipement d'un technicien (restock)

**Contexte** : Le technicien passe au dépôt. Le gestionnaire lui prépare du stock complémentaire.

**Depuis la fiche technicien :**
1. L'utilisateur accède à la fiche du technicien
2. Il clique sur "Restocker"
3. Il sélectionne les produits et quantités à ajouter
4. Il valide
5. L'inventaire actuel est archivé (snapshot dans l'historique)
6. Les quantités sont ajoutées à l'inventaire existant (additionnées si le produit est déjà présent)
7. Le stock central est décrémenté pour chaque produit attribué

**Depuis le tableau de bord :**
1. L'utilisateur clique sur "Restocker un technicien"
2. Un sélecteur de technicien s'affiche (recherche par nom, email)
3. Il sélectionne le technicien
4. Le formulaire de restock s'ouvre (identique au formulaire ci-dessus)
5. Il sélectionne les produits et quantités, puis valide

### 4.3 Flux : Constat de perte

**Contexte** : Un produit a été cassé ou perdu, il faut ajuster le stock.

1. L'utilisateur accède au formulaire de mouvement de stock
2. Il sélectionne le produit
3. Il choisit la direction "Sortie"
4. Il choisit le type "Perte/Casse"
5. Il saisit la quantité perdue
6. Il ajoute une note explicative
7. Le stock central est décrémenté

### 4.4 Flux : Invitation d'un nouveau membre

**Contexte** : Un administrateur veut donner accès à un collègue.

1. L'administrateur va dans Paramètres > Équipe
2. Il saisit l'email du collègue et choisit le rôle (Administrateur ou Membre)
3. Il valide l'invitation
4. Le collègue reçoit un lien d'invitation (mécanisme d'envoi non visible dans l'application)
5. Le collègue clique sur le lien
6. S'il n'a pas de compte, il s'inscrit (avec la même adresse email que l'invitation)
7. S'il a un compte, il se connecte
8. L'invitation est acceptée et le collègue rejoint l'organisation

### 4.5 Flux : Première utilisation (onboarding)

**Contexte** : Un utilisateur vient de s'inscrire pour la première fois.

1. L'utilisateur s'inscrit et confirme son email
2. Il se connecte
3. L'application détecte qu'il n'a aucune organisation
4. Il est redirigé vers l'assistant d'onboarding
5. Il crée son organisation (nom obligatoire)
6. Il peut créer des catégories (optionnel)
7. Il peut créer des produits (optionnel)
8. Il peut créer un premier technicien (optionnel)
9. Il voit un tutoriel sur les mouvements de stock
10. Il est redirigé vers le tableau de bord avec son organisation opérationnelle

### 4.6 Flux : Scan QR code sur mobile

**Contexte** : Un magasinier scanne un produit en rayon pour enregistrer un mouvement rapidement.

1. L'utilisateur ouvre l'application sur son téléphone
2. Il appuie sur le bouton flottant de scan (en bas à droite)
3. La caméra s'active
4. Il scanne le QR code collé sur le produit ou l'étagère
5. L'application identifie le produit à partir du QR code
6. Le formulaire de mouvement s'ouvre avec le produit pré-sélectionné
7. L'utilisateur choisit entrée/sortie, saisit la quantité, et valide

---

## 5. Règles métier critiques

### 5.1 Algorithme de score de stock

Chaque produit possède un **score de stock** calculé sur une échelle de 0 à 100%. Ce score détermine l'état de santé du stock d'un produit. Il est utilisé pour les alertes, le tri et les indicateurs visuels.

**Paramètres du calcul :**
- `stock_current` : quantité actuelle en stock
- `stock_min` : seuil minimum (en dessous, le stock est critique)
- `stock_max` : niveau optimal (le stock idéal à maintenir)

**Règles de calcul :**

| Situation | Score | Explication |
|-----------|-------|-------------|
| Stock = 0 ou stock <= stock_min | **0%** | Stock critique : rupture imminente ou effective |
| Stock entre min et max | **Proportionnel** : ((stock - min) / (max - min)) × 100 | Zone normale : plus on se rapproche du max, mieux c'est |
| Stock = stock_max | **100%** | Stock optimal |
| Stock entre max et 2× max | **Décroissant** : 100 - ((stock - max) / max) × 100 | Surstockage modéré : le score redescend |
| Stock >= 2× stock_max | **0%** | Surstockage critique : autant d'alerte qu'un stock vide |

**Interprétation visuelle du score :**

| Score | Statut | Couleur | Badge |
|-------|--------|---------|-------|
| 0% | Critique | Rouge | Destructif |
| 1% - 29% | Bas | Rouge | Destructif |
| 30% - 59% | Attention | Orange | Avertissement |
| 60% - 89% | Bon | Vert | Succès |
| 90% - 100% | Optimal | Vert | Succès |

> **Règle contre-intuitive** : Un stock **trop élevé** (au-delà du double du maximum) est considéré aussi critique qu'un stock vide. Cela traduit la philosophie que le surstockage est aussi problématique que la rupture (coût d'immobilisation, risque de péremption, etc.).

### 5.2 Unicité et intégrité des données

| Contrainte | Entité | Description |
|------------|--------|-------------|
| Email unique | Technicien | Deux techniciens de la même organisation ne peuvent pas avoir le même email |
| Slug unique | Organisation | Deux organisations ne peuvent pas avoir le même identifiant court (slug) |
| Invitation unique | Invitation | On ne peut pas envoyer deux invitations à la même adresse email pour la même organisation |
| Stock suffisant | Mouvement | Impossible de sortir plus de stock qu'il n'y en a de disponible |
| Quantité positive | Mouvement | La quantité d'un mouvement doit être strictement positive (>= 1) |
| Catégorie sans enfants | Catégorie | Impossible de supprimer une catégorie qui a des sous-catégories |

### 5.3 Isolation des données par organisation

Toutes les données sont **cloisonnées par organisation**. Un utilisateur ne voit que les données de l'organisation actuellement sélectionnée. Les entités concernées :
- Produits
- Catégories
- Techniciens
- Mouvements de stock
- Inventaires des techniciens

Il n'existe aucune vue inter-organisations pour un utilisateur standard.

### 5.4 Seuils de réapprovisionnement technicien

Le système considère qu'un technicien **doit être réapprovisionné** si :
- Son dernier restock date de plus de **7 jours**, ou
- Il n'a **jamais** été restocké (pas d'historique)

Ce seuil de 7 jours est codé en dur et n'est pas configurable par l'utilisateur.

### 5.5 Valeurs par défaut des produits

| Paramètre | Valeur par défaut |
|-----------|------------------|
| Stock minimum (stock_min) | 10 |
| Stock maximum (stock_max) | 100 |
| Stock initial (stock_current) | 0 |

Si l'utilisateur ne modifie pas ces valeurs à la création, un produit créé sans stock sera immédiatement en alerte critique (score = 0% car stock_current 0 <= stock_min 10).

### 5.6 Génération automatique du SKU

Si l'utilisateur ne saisit pas de référence SKU lors de la création d'un produit, le système en génère une automatiquement selon le format :
```
[3 premières lettres du nom en majuscules]-[4 chiffres aléatoires]
```

**Exemples :**
- "Vis à bois 40mm" → `VIS-8472`
- "Câble RJ45 Cat6" → `CÂB-3291`

> **Remarque** : Le SKU auto-généré peut contenir des caractères accentués (issus du nom du produit), ce qui pourrait poser des problèmes d'intégration avec certains systèmes externes.

### 5.7 Algorithme du score de santé (Health Score)

Le tableau de bord affiche un **score de santé global** de l'organisation, calculé côté base de données via le RPC `get_health_score`. Le score part de **100 points** et des **pénalités** sont soustraites selon l'état du stock et des techniciens. Le score est borné entre 0 et 100.

**Les 6 règles de pénalité :**

| # | Règle | Pénalité | Plafond |
|---|-------|----------|---------|
| 1 | Produits en rupture de stock (stock = 0) | -15 pts / produit | 60 pts max |
| 2 | Produits sous le seuil minimum (0 < stock ≤ stock_min) | -4 pts / produit | 20 pts max |
| 3 | Techniciens jamais restockés (aucun historique d'inventaire) | -8 pts / technicien | 40 pts max |
| 4 | Techniciens non restockés depuis 7+ jours | -5 pts / technicien | 20 pts max |
| 5 | Sorties > entrées de 30% sur les 30 derniers jours | -10 pts (fixe) | 10 pts |
| 6 | Aucune entrée de stock depuis 14 jours | -5 pts (fixe) | 5 pts |

> **Note** : Les produits et techniciens archivés sont exclus du calcul des pénalités.

**Interprétation visuelle :**

| Score | Couleur | Libellé |
|-------|---------|---------|
| ≥ 90 | Vert | "Excellent" |
| ≥ 70 | Vert | "Quelques points d'attention" |
| ≥ 40 | Orange | "Attention requise" |
| < 40 | Rouge | "Situation critique" |

**Tendance mensuelle** : le score du mois précédent est reconstitué en rétro-calculant le stock de chaque produit (stock actuel + sorties du mois - entrées du mois), puis en appliquant les mêmes 6 règles. La direction (hausse, baisse, stable) et l'écart en points sont affichés.

**Historique** : le RPC `get_health_score_history` reconstitue le score pour chacun des 6 derniers mois en annulant tous les mouvements postérieurs à chaque fin de mois, permettant d'afficher la courbe d'évolution du score dans l'onglet Aperçu.

---

## 6. Intégrations externes

### 6.1 Authentification

L'authentification des utilisateurs est gérée par **Supabase Auth**, un service tiers. Les fonctionnalités couvertes :
- Inscription par email/mot de passe
- Connexion par email/mot de passe
- Envoi d'emails de confirmation d'inscription
- Envoi d'emails de réinitialisation de mot de passe
- Gestion des sessions (tokens)

> **Note** : Il n'y a pas de connexion via des fournisseurs sociaux (Google, GitHub, etc.) dans la version actuelle.

### 6.2 Stockage de fichiers

Les images (logos d'organisation, photos de produits) sont stockées dans **Supabase Storage**, un service de stockage de fichiers en ligne. Deux espaces (buckets) sont utilisés :
- `organization-logos` : pour les logos des organisations
- `product-images` : pour les photos des produits

Les fichiers sont accessibles publiquement via une URL générée par le service.

### 6.3 Analytique

L'application intègre **Google Analytics** pour le suivi des visites et comportements utilisateurs. L'identifiant de suivi est configuré dans l'application.

### 6.4 Gestion des paramètres d'URL

L'application utilise **nuqs** pour la gestion des paramètres d'URL (filtres, pagination, recherche). Cela permet de :
- Partager un lien avec des filtres pré-appliqués
- Conserver les filtres lors du rechargement de la page
- Naviguer dans l'historique du navigateur avec les filtres

---

## 7. Fonctionnalités non implémentées ou incomplètes

### 7.1 Calendrier

La page `/calendar` existe et contient un **calendrier interactif complet** (basé sur FullCalendar) avec :
- Vue mensuelle, hebdomadaire et journalière
- Création d'événements par clic sur une date
- Déplacement d'événements par glisser-déposer
- Redimensionnement d'événements
- Barre latérale et panneau de détail d'événement

Cependant, le lien vers cette page est **commenté (désactivé)** dans le menu de navigation. Les événements ne sont **pas liés aux données métier** (stock, restocks, techniciens) — il s'agit d'un calendrier générique avec des événements locaux. L'intégration avec les données de stock n'est pas implémentée.

### 7.2 Paramètres généraux

La page "Paramètres" principale affiche un message "Bientôt disponible" avec une icône. Aucun paramètre de configuration n'est implémenté (langue, devise, préférences d'affichage, seuils personnalisables, etc.).

### 7.3 Notifications

Un composant de notifications existe dans le code, mais il est **commenté (désactivé) dans l'en-tête**. L'icône de cloche n'apparaît donc pas dans l'interface utilisateur. Le composant utilise des **données factices** (mocked) en français (alertes stock bas, réception livraison, rappel entretien, etc.) avec des boutons Accept/Decline pour certaines. Un lien "Notifications" apparaît dans le menu utilisateur, mais il n'est relié à aucune fonctionnalité.

Il n'y a aucun système de notifications réelles implémenté.

### 7.4 Données factices sur certaines pages

Les composants à données fictives identifiés précédemment (cartes d'aperçu "Flux de stock", section "Flux" de la fiche produit) ont été **supprimés**. Toutes les données affichées dans l'application sont désormais connectées aux vraies données de l'organisation.

### 7.5 Envoi d'emails d'invitation

Le code crée les invitations en base de données et génère un token, mais aucun mécanisme d'envoi d'email n'est visible dans le code de l'application. L'email d'invitation doit être communiqué manuellement à la personne invitée (copier/coller du lien), ou un service externe non visible dans le code s'en charge.

### 7.6 Modification de l'adresse email

La page "Mon Compte" permet de modifier le nom et le mot de passe, mais l'adresse email est **affiché en lecture seule** (champ grisé). Un utilisateur qui change d'adresse email ne peut pas mettre à jour son compte.

### 7.7 Protection des routes côté serveur

L'application ne dispose pas de middleware côté serveur pour protéger les routes. La vérification de l'authentification et de l'appartenance à une organisation se fait uniquement côté client, dans le composant qui englobe les pages protégées. Cela signifie qu'un utilisateur non authentifié pourrait théoriquement voir un écran vide ou de chargement avant d'être redirigé.

### 7.8 Audit et traçabilité des actions

Il n'y a pas de journal d'audit des actions des utilisateurs. Les mouvements de stock ne sont pas rattachés à l'utilisateur qui les a créés (pas de champ "créé par"). Il est impossible de savoir quel utilisateur a effectué une opération.

> **Risque** : En cas de litige ou d'erreur, il est impossible de retracer qui a enregistré un mouvement de stock, modifié un produit, ou supprimé un technicien.

### 7.9 Actions groupées sur les produits

La liste des produits dispose de cases à cocher permettant de sélectionner plusieurs produits (y compris "tout sélectionner"), mais **aucune action groupée** n'est implémentée (suppression en masse, export de la sélection, modification par lot, etc.). La sélection est purement visuelle.

### 7.10 Retour de stock technicien

Il n'existe aucun flux permettant à un technicien de **retourner** du stock au stock central. Pour corriger un inventaire de technicien, il faudrait :
- Créer manuellement des entrées de stock pour les produits retournés
- Ajuster l'inventaire du technicien manuellement

---

## 8. Glossaire

| Terme | Définition |
|-------|------------|
| **Organisation** | Entité représentant une entreprise ou une équipe. Toutes les données (produits, techniciens, mouvements) sont rattachées à une organisation. Un utilisateur peut être membre de plusieurs organisations. |
| **Membre** | Utilisateur de l'application appartenant à une organisation, avec un rôle défini (propriétaire, administrateur ou membre). |
| **Technicien** | Personne de terrain à qui l'organisation attribue du matériel. N'est PAS un utilisateur de l'application. Géré par les membres de l'organisation. |
| **Produit** | Article référencé dans le stock de l'organisation (vis, câble, pièce détachée, etc.). Possède des seuils de stock min/max et un stock courant. |
| **Catégorie** | Regroupement hiérarchique de produits. Peut contenir des sous-catégories. |
| **Stock central** | Quantité de chaque produit disponible au dépôt/entrepôt de l'organisation. Correspond au champ "stock actuel" du produit. |
| **Inventaire technicien** | Ensemble des produits et quantités actuellement en possession d'un technicien. |
| **Mouvement de stock** | Enregistrement d'une variation du stock central : entrée (augmentation) ou sortie (diminution). |
| **Entrée** | Mouvement qui augmente le stock central (réception fournisseur, retour, etc.). |
| **Sortie technicien** | Mouvement qui diminue le stock central et attribue les produits à un technicien identifié. |
| **Sortie anonyme** | Mouvement qui diminue le stock central sans destinataire identifié. |
| **Perte/Casse** | Mouvement qui diminue le stock central pour constater une perte, un vol ou une casse. |
| **Restock** | Action de réapprovisionner un technicien en lui attribuant des produits depuis le stock central. Les produits sont ajoutés à l'inventaire existant du technicien (les quantités sont additionnées si le produit est déjà présent). |
| **Snapshot** | Photo instantanée de l'inventaire d'un technicien, enregistrée dans l'historique à chaque restock. Permet de retrouver l'état exact de l'inventaire à un moment donné. |
| **Score de stock** | Indicateur de 0% à 100% reflétant la santé du stock d'un produit par rapport à ses seuils min et max. |
| **Score de santé (Health Score)** | Indicateur global de 0 à 100 points reflétant la santé de l'ensemble du stock et des techniciens d'une organisation. Calculé par soustraction de pénalités (ruptures, sous-stock, techniciens non restockés, etc.) depuis un score initial de 100. |
| **Archivage (soft delete)** | Mécanisme de suppression logique : l'entité (produit ou technicien) est marquée avec une date d'archivage et disparaît des listes et statistiques, mais ses données historiques sont conservées en base de données. |
| **SKU** | Stock Keeping Unit — référence unique d'un produit. Peut être saisie manuellement ou auto-générée. |
| **Slug** | Identifiant court et unique d'une organisation, composé de lettres minuscules, chiffres et tirets. Généré à partir du nom. |
| **QR Code** | Code-barres 2D imprimable, généré pour chaque produit, permettant de scanner le produit avec un téléphone pour accéder rapidement au formulaire de mouvement de stock. |
| **Onboarding** | Assistant de première configuration guidant le nouvel utilisateur dans la création de son organisation, ses premières catégories, produits et techniciens. |
| **Multi-tenant** | Architecture où une même application sert plusieurs organisations, avec des données totalement isolées entre elles. |
| **Invitation** | Mécanisme permettant à un propriétaire ou administrateur d'envoyer un lien à un tiers pour qu'il rejoigne l'organisation avec un rôle prédéfini. |
| **Token** | Jeton unique et temporaire généré pour valider une invitation. Expire après une certaine durée. |
| **Atomicité** | Propriété garantissant qu'une opération s'exécute entièrement ou pas du tout. Utilisé pour les mouvements de stock afin d'éviter les incohérences en cas d'accès simultanés. |
