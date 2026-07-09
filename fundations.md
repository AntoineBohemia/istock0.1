# Design system — logiciel de gestion de stock

Guide destiné à Claude Code, à appliquer sur une **base de code existante**.

---

## 0. Contraintes d'application (à lire en premier)

- **On modifie, on ne réécrit pas.** Ne restructure pas l'arborescence, ne change pas les APIs des composants existants, ne touche pas au routing. Les seuls fichiers concernés par ce guide : `globals.css` (tokens), la config de fonts, et l'ajout d'une poignée de primitives (statut, chiffre héros, geste entrée/sortie).
- **Incrémental.** Applique une section à la fois, vérifie que le build passe et que l'app tourne avant de continuer.
- **N'exécute pas `shadcn apply --preset` nu** : ça écrase les composants déjà customisés. Si un preset doit être appliqué, uniquement `--only theme`. La source de vérité des tokens est ce document, pas le CLI.
- Stack supposée : shadcn/ui + Tailwind + React. Si l'app est en `.dark` par défaut, garde-la ainsi (voir §2).

---

## 1. Principe directeur

**Le ludique vit dans l'interaction, pas dans la couleur.** La base visuelle est sobre et disciplinée ; tout le budget "donne envie" part dans le geste, le mouvement et le retour. Une base colorée tape-à-l'œil ne rend pas un outil quotidien plus agréable, elle le fatigue.

**Trois familles de couleurs qui ne se mélangent jamais :**

1. **Accent (action + identité)** — une seule couleur, le violet. Sert aux actions primaires, à l'état actif/sélectionné, et au focus clavier. **Jamais** pour un statut.
2. **Statut (sémantique, réservé)** — critique / attention / standard. Ces couleurs ne servent qu'à ça.
3. **Neutres (surfaces)** — gris des fonds, bordures, texte. Tout ce qui n'est ni action ni statut est neutre.

Règle mentale : *si ce n'est pas l'action primaire, l'état actif, ou un statut, c'est gris.*

---

## 2. Tokens couleur — `globals.css`

Conserve les tokens existants du projet. **Ajoute** la couche statut ci-dessous (elle manque dans le preset d'origine). Valeurs en `oklch` pour rester cohérent avec l'existant.

```css
:root {
  /* --- Base existante conservée (violet + neutres) --- */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0.008 326);
  --primary: oklch(0.491 0.27 292.581);            /* accent violet = action */
  --primary-foreground: oklch(0.969 0.016 293.756);
  --muted-foreground: oklch(0.542 0.034 322.5);    /* texte neutre / standard par défaut */
  --border: oklch(0.922 0.005 325.62);
  --ring: oklch(0.711 0.019 323.02);
  --radius: 0.45rem;

  /* --- Couche STATUT (à ajouter) --- */
  --critique: oklch(0.577 0.245 27.3);
  --critique-foreground: oklch(0.985 0 0);
  --critique-bg: oklch(0.955 0.040 27.3);

  --attention: oklch(0.700 0.170 55);              /* orange brûlé */
  --attention-foreground: oklch(0.280 0.070 55);
  --attention-bg: oklch(0.960 0.045 65);

  --standard: oklch(0.620 0.130 155);              /* vert, usage discret uniquement */
  --standard-foreground: oklch(0.300 0.060 155);
  --standard-bg: oklch(0.960 0.030 158);
}

.dark {
  --background: oklch(0.145 0.008 326);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.541 0.281 293.009);
  --primary-foreground: oklch(0.969 0.016 293.756);
  --muted-foreground: oklch(0.711 0.019 323.02);
  --border: oklch(1 0 0 / 10%);
  --ring: oklch(0.542 0.034 322.5);

  /* --- Couche STATUT (dark) --- */
  --critique: oklch(0.704 0.191 22.2);
  --critique-foreground: oklch(0.985 0 0);
  --critique-bg: oklch(0.300 0.090 22 / 40%);

  --attention: oklch(0.800 0.150 60);
  --attention-foreground: oklch(0.985 0 0);
  --attention-bg: oklch(0.320 0.070 55 / 45%);

  --standard: oklch(0.720 0.130 155);
  --standard-foreground: oklch(0.985 0 0);
  --standard-bg: oklch(0.300 0.060 158 / 40%);
}
```

Expose ces tokens en utilitaires Tailwind via `@theme` dans `globals.css` (Tailwind 4 — il n'y a plus de `tailwind.config.js` ni `theme.extend.colors`) :

```css
@theme {
  --color-critique: var(--critique);
  --color-critique-foreground: var(--critique-foreground);
  --color-critique-bg: var(--critique-bg);

  --color-attention: var(--attention);
  --color-attention-foreground: var(--attention-foreground);
  --color-attention-bg: var(--attention-bg);

  --color-standard: var(--standard);
  --color-standard-foreground: var(--standard-foreground);
  --color-standard-bg: var(--standard-bg);
}
```

Classes disponibles : `text-critique`, `bg-critique-bg`, `text-attention`, `bg-attention-bg`, `text-standard`, `bg-standard-bg`, etc.

**Charts** : une série = l'accent violet (variante). N'utilise les couleurs de statut dans un graphe **que** si le graphe montre littéralement des statuts. Le graphe "évolution du prix" = une ligne violette, point.

---

## 3. Typographie

- **Titres + chiffres** : `Space Grotesk` (500 / 700). C'est la voix de l'identité et le support des chiffres héros.
- **Corps + UI + tableaux** : `Inter` (400 / 500). Workhorse lisible en petit et en dense.
- **Règle des deux fonts.** Une display + une utilitaire. **Supprimer Oxanium** : c'est une font display anguleuse, illisible en corps et en concurrence avec Space Grotesk.
- **Chiffres alignés** : sur toute colonne numérique et tout chiffre héros, appliquer `font-variant-numeric: tabular-nums`. Pas de font mono en plus.

```css
--font-heading: 'Space Grotesk', sans-serif;
--font-sans: 'Inter', sans-serif;
```

Échelle indicative : chiffre héros 48–64px/700 ; titre de carte 18px/500 ; corps 15–16px/400 ; label/caption 12–13px/500 en `--muted-foreground`.

---

## 4. Radius et densité

- `--radius: 0.45rem` (~7px). Assez rond pour être chaleureux, assez sobre pour rester pro. Ne pas descendre à 2px.
- Tableaux : denses. Cible tactile mobile : min **44px** de hauteur sur les zones cliquables.

---

## 5. Statut — règles d'application

Trois états : **critique** (agir maintenant), **attention** (bientôt bas), **standard** (ok).

- **critique** → `--critique` (rouge). Pastille + texte, et le chiffre du stock passe en `--critique`.
- **attention** → `--attention` (orange). Idem.
- **standard** → **rendu discret.** 80% des lignes seront standard ; si tout est vert vif, le signal est noyé. Rendu par défaut : texte neutre (`--muted-foreground`) + une petite pastille `--standard`. Pas de fond plein vert.

Les **seuils** (à partir de quel niveau une ligne passe attention, puis critique) sont un paramètre **métier**, pas une constante en dur. Expose-les en config. Valeur placeholder tant que non validée avec le client : `attention` si `stock <= min * 1.4`, `critique` si `stock <= min`. **Ne pas figer ces valeurs sans validation.**

Composant `StatusPill` (pastille) : `rounded-full`, 13px/500 en Space Grotesk. Rendu différencié selon le statut :
- **critique / attention** : `text-{statut}` sur `bg-{statut}-bg`.
- **standard** : texte `--muted-foreground` sur fond transparent + petite pastille colorée `--standard` sans fond plein. Rendu délibérément discret — c'est le cas le plus fréquent (80% des lignes).

---

## 6. La couche ludique — Motion

C'est ici que part tout le budget "donne envie". Librairie : `motion` (import depuis `motion/react`). Avant d'installer, vérifier que `framer-motion` n'est **pas** déjà présent dans `package.json` — les deux conflictent. Si présent : `pnpm remove framer-motion` d'abord.

Respecter `useReducedMotion()` partout — import depuis `motion/react` également. Springs d'UI : `bounce < 0.1`.

Par ordre d'impact :

**1. Geste entrée/sortie (le moment signature, ~70% du ressenti).**
```tsx
<motion.button
  whileTap={{ scale: 0.96 }}
  transition={{ type: 'spring', bounce: 0.1, duration: 0.2 }}
  onClick={() => { navigator.vibrate?.(15); onEntrer(); }}
>
  Entrer
</motion.button>
```
Le chiffre du stock s'incrémente visiblement après l'action.

**2. Chiffres héros animés** (valeur totale du stock, entrées annuelles) : `AnimateNumber` de Motion, count-up au chargement et à chaque mise à jour.

**3. Transition de couleur du statut** quand un stock franchit un seuil : le chiffre passe de neutre → orange → rouge via une transition CSS/Motion sur la couleur. C'est le moment le plus satisfaisant du produit.

**4. Tri et filtrage animés** : les lignes/cards se réordonnent avec la prop `layout` (+ `AnimatePresence` pour entrée/sortie), elles ne sautent pas.

**5. Toasts de confirmation** : `sonner`, avec une vraie voix (voir §8).

---

## 7. Composants — règles

- **Boutons.** Action primaire = accent violet plein (`Entrer`). Actions secondaires = contour neutre (`Sortir`). Un seul bouton accent par **zone d'action principale** (barre d'outils globale, formulaire) — pas un par ligne de tableau.
- **Chiffres héros** : Space Grotesk 700, `tabular-nums`, `AnimateNumber`.
- **Tableaux** : TanStack Table (headless) + pattern shadcn data-table. Tri sur **toutes** les colonnes, sélection de lignes (les coches), filtres incluant **société**. État tri/filtre synchronisé à l'URL (nuqs) pour partage de vue filtrée.
- **Naming d'action cohérent** : le libellé d'un bouton et le toast qui en découle partagent le même verbe. `Entrer` → toast `Entré`. `Sortir` → `Sorti`. `Archiver` → `Archivé`.

---

## 8. Copie / voix

Direct, sec, sans mièvrerie. Français. Sentence case. C'est du BTP.

- Confirmations : `+50 entrés · 340 en stock`, pas "Opération réussie".
- Empty states = invitation, pas excuse : `Aucun produit en critique. Tout roule.` plutôt que "Aucune donnée à afficher."
- Erreurs : dire quoi et comment corriger, dans la voix de l'app, sans "Erreur :" ni première personne.

---

## 9. Interdits (le piège "hyper ludique")

- Pas de confettis, pas de mascotte, pas de badges, pas de points, pas de son au clic, pas de gamification. Sur un outil utilisé des dizaines de fois par jour par un public BTP, ça devient vite insupportable.
- "standard" jamais en fond plein vert partout (noie le signal).
- Ne jamais réutiliser une couleur de statut comme décoration, ni l'accent comme statut.
- Ne pas restructurer le code existant. Ne pas lancer `shadcn apply --preset` nu.

---

## 10. Ordre d'exécution pour Claude Code

1. Ajouter la couche statut dans `globals.css` (:root + .dark) + utilitaires Tailwind. Vérifier build.
2. Fonts : Space Grotesk (titres/chiffres) + Inter (corps), supprimer Oxanium. `tabular-nums` sur les colonnes de chiffres.
3. Installer `motion`, `sonner` et `nuqs`. Vérifier que `framer-motion` n'est pas déjà présent (`pnpm remove framer-motion` si besoin).
4. Créer les primitives `StatusPill` et `HeroNumber` (AnimateNumber). Les brancher sur les écrans existants sans changer leur logique.
5. Câbler le geste entrée/sortie (whileTap + vibrate + incrément + toast).
6. Tableaux : tri toutes colonnes + sélection + filtre société, animation `layout` au réordonnancement. Vérifier que toutes les zones cliquables font min 44px de hauteur (cible tactile mobile).

À chaque étape : le build passe, l'app tourne, l'existant n'est pas cassé.