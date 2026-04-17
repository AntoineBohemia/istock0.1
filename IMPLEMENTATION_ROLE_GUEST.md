# INSTRUCTIONS D'IMPLÉMENTATION : Rôle "guest" (invité restreint)

> Document de référence pour l'ajout d'un 4ᵉ rôle `guest`.
> Chaque tâche = une session de travail autonome.
> Ne jamais lancer plusieurs tâches en même temps.

> **Tooling** : ce plan suppose l'utilisation du **MCP Supabase** (outils `mcp__supabase__*`) pour inspecter l'état réel de la DB, appliquer les migrations, tester sur branche isolée et régénérer les types. Voir la section "Outillage MCP Supabase" ci-dessous.

---

## MÉTHODOLOGIE TDD

Chaque tâche suit le cycle **RED → GREEN → REFACTOR** avec des assertions **binaires** (réussit / échoue).

### Convention de test
1. **Avant chaque modif** : écrire l'assertion de ce qu'on veut. Elle doit **échouer**.
2. **Appliquer la modif** minimum nécessaire pour que l'assertion passe.
3. **Vérifier les non-régressions** : les assertions des tâches précédentes doivent toujours passer.
4. **Jamais de modif sans test** — si une assertion ne peut pas être écrite, refaire la conception.

### Outils de test par couche
| Couche | Outil | Format d'assertion |
|---|---|---|
| DB schema (CHECK, colonnes) | `mcp__supabase__execute_sql` | `SELECT count(*) = 1` attendu |
| RLS policies | `mcp__supabase__execute_sql` avec `SET LOCAL request.jwt.claims` | query autorisée renvoie des rows / query interdite renvoie 0 rows ou erreur |
| RLS advisor | `mcp__supabase__get_advisors` type=security | liste sans régression vs baseline T0 |
| Types TS | `npx tsc --noEmit` | exit 0 |
| Logique frontend (helpers, stores) | `npx vitest run` | pass |
| Build Next.js | `npm run build` ou `npx next build` | exit 0 |

### Condition de succès globale (à vérifier avant tout merge)
```bash
npx tsc --noEmit                      # typecheck
npx vitest run                        # tests unitaires
npm run build                         # build Next.js
# + toutes les assertions SQL de la tâche en cours
# + get_advisors sans nouveau warning
```

Si **une seule** de ces commandes échoue → on ne passe pas à la tâche suivante.

---

## OUTILLAGE MCP SUPABASE

Le projet dispose du MCP Supabase. On l'utilise pour sécuriser la mise en œuvre :

| Outil MCP | Utilisation dans ce plan |
|---|---|
| `list_tables`, `list_migrations`, `list_extensions` | T0 — état réel avant modif |
| `execute_sql` | T0, T2, T7 — lire RLS existantes, tester des policies avec un user simulé |
| `get_advisors` (type=`security`, `performance`) | T2, T7 — lint automatique des RLS après changement |
| `create_branch` / `list_branches` / `merge_branch` / `reset_branch` / `delete_branch` | T1, T2 — appliquer les migrations sur une branche Supabase isolée, puis merger |
| `apply_migration` | T1, T2 — applique une migration nommée (enregistrée dans l'historique) |
| `generate_typescript_types` | Après T1 et T2 — régénérer les types TS consommés par l'app |
| `list_edge_functions` / `get_edge_function` / `deploy_edge_function` | T6 — si on ajuste le template d'email pour le rôle `guest` |
| `get_logs` | Debug si T2 casse quelque chose en prod |
| `search_docs` | Recherche de best practices RLS / CHECK constraints si besoin |

**Règle d'or** : **jamais `apply_migration` directement en production**. Toujours passer par `create_branch` → appliquer → tester → `merge_branch`.

---

## OBJECTIF FONCTIONNEL

Un utilisateur invité à une organisation avec le rôle **`guest`** doit :

### Ce qu'il peut faire
- ✅ Voir la page **Techniciens** (`/users`)
- ✅ Voir la page **Stock produits** (`/product`) + modal Stock rapide (`/stock`)
- ✅ Faire un **restock** (entrée de stock)
- ✅ Faire une **sortie de stock** (vers technicien ou autre)

### Ce qu'il NE peut PAS faire
- ❌ Accéder au Dashboard (`/global`)
- ❌ Accéder au Flux de stock / historique (`/orders`) — **à valider avec l'utilisateur**
- ❌ Accéder à aucune page `/settings/*` (membres, organisations, paramètres)
- ❌ Inviter d'autres membres
- ❌ Modifier des produits, techniciens, ou données de l'organisation hors mouvements
- ❌ Être promu ou promouvoir quelqu'un

---

## ARCHITECTURE ACTUELLE (RAPPEL)

### Rôles existants
```
owner   → tout
admin   → tout sauf supprimer org / transférer propriété
member  → lire + mouvements de stock + actions CRUD métier
```

### Points de vérité
- Type TS : `lib/stores/organization-store.ts:9` → `role: "owner" | "admin" | "member"`
- Helpers permissions : `lib/stores/organization-store.ts:59-73` (`canInvite`, `canManageMembers`, `canDeleteOrganization`, `canManageAdmins`)
- Contrainte DB : `supabase/migrations/20260326000400_secure_buckets_and_role_check.sql:9` → `CHECK role IN ('owner', 'admin', 'member')`
- Sidebar statique : `components/layout/sidebar.tsx:133+` boucle sur `lib/routes-config.tsx`
- Aucun `middleware.ts` ne filtre par rôle (seul `proxy.ts` gère l'auth Supabase)

### Problèmes à ne pas reproduire
- Les checks client-only sont bypassables via URL directe → **la sécurité doit venir des RLS Supabase**
- Le rôle en localStorage est modifiable → **ne jamais trust le rôle côté client pour autoriser une action**

---

## TÂCHE 0 — Constater l'état réel de la DB (via MCP)

**Objectif** : avant toute modif, figer ce qui existe déjà côté Supabase. Cette tâche remplace les hypothèses faites dans l'audit initial par des faits.

**Étapes**
1. `mcp__supabase__list_tables` → confirmer que les tables `organizations`, `user_organizations`, `organization_invitations` existent avec les colonnes attendues
2. `mcp__supabase__list_migrations` → voir l'historique réellement appliqué (peut différer des fichiers locaux si des fix manuels ont été faits)
3. `mcp__supabase__execute_sql` — exécuter :
   ```sql
   -- CHECK constraints actuels
   SELECT conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid IN ('user_organizations'::regclass, 'organization_invitations'::regclass)
     AND contype = 'c';

   -- Policies RLS actuelles sur les tables concernées
   SELECT schemaname, tablename, policyname, cmd, qual, with_check
   FROM pg_policies
   WHERE tablename IN (
     'user_organizations','organization_invitations','organizations',
     'products','technicians','stock_movements','technician_inventory','orders'
   )
   ORDER BY tablename, policyname;

   -- Fonctions helper SQL existantes
   SELECT proname, pg_get_function_arguments(oid), pg_get_function_result(oid)
   FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace
     AND proname IN ('is_organization_owner','is_org_admin_or_owner','get_user_organization_ids');
   ```
4. `mcp__supabase__get_advisors` (type=`security`) → récupérer la baseline des avertissements actuels pour comparer après T2

**Livrable** : un court compte-rendu collé dans le PR décrivant l'état actuel (CHECK constraints, RLS par table, helpers dispos). Sert de référence pour tous les commits suivants.

### Résultat T0 (exécuté 2026-04-17)

**CHECK constraints**
- `user_organizations.role` : DOUBLON (à nettoyer en T1) — `check_valid_role` + `user_organizations_role_check`, tous deux `IN ('owner','admin','member')`
- `organization_invitations.role` : `IN ('admin','member')` — pas de `owner` (volontaire)

**Tables publiques + RLS**
| Table | Pol. | Note |
|---|---|---|
| products, technicians, stock_movements, technician_inventory | 1 ALL chacune | **Pas de check de rôle** — filtre uniquement `org_id` via `get_user_organization_ids()`. Un guest aurait tout CRUD par défaut → à restreindre en T2 |
| categories, suppliers, technician_inventory_history | 1-4 | À auditer plus finement en T2 |
| organizations | 4 | `insert` ouvert (WARN baseline, volontaire) |
| user_organizations | 5 | owner/admin/self — OK |
| organization_invitations | 5 | owner/admin + self-email — OK |
| onboarding_progress | 3 | À ignorer pour ce plan |

**Pas de table `orders`** — la route UI `/orders` affiche des `stock_movements`.

**Helpers SQL (tous SECURITY DEFINER)**
`is_organization_owner(org_id)`, `is_org_admin_or_owner(user_id, org_id)`, `get_user_organization_ids()` et surcharge, RPCs `create_stock_entry`, `create_stock_exit`, `accept_invitation_secure`, `leave_organization`, `transfer_ownership`, `get_invitation_details`.

**Baseline `get_advisors(security)` = 13 lints**
- 2 ERROR (préexistants, hors scope guest) : `organization_members_view` expose `auth.users` + est SECURITY DEFINER
- 8 WARN : `function_search_path_mutable` sur les fonctions métier
- 1 WARN : `rls_policy_always_true` sur `insert_organizations` (volontaire)
- 2 WARN : public buckets avec listing (`organization-logos`, `product-images`)
- 1 WARN auth : leaked password protection désactivée

→ **Aucune régression tolérée** en T2 par rapport à ces 13 lints.

**Implications pour T2**
- Les policies `ALL` existantes sur products/stock_movements/technician_inventory/technicians doivent être remplacées par 2 policies (SELECT + write-restricted) filtrant l'écriture sur `role IN ('owner','admin','member')`.
- `create_stock_entry` et `create_stock_exit` sont SECURITY DEFINER → elles bypassent les RLS donc le guest peut les appeler même si on bloque l'écriture directe sur stock_movements. ✅
- Créer un helper `is_org_member_non_guest(org_id)` ou équivalent pour simplifier les policies.

---

## TÂCHE 1 — DB : étendre l'enum de rôles

**Objectif** : autoriser `guest` dans `user_organizations.role` et `organization_invitations.role`.

**Fichiers**
- Nouvelle migration : `supabase/migrations/YYYYMMDDHHMMSS_add_guest_role.sql`

**Contenu**
```sql
-- Drop et recrée la contrainte CHECK sur user_organizations.role
ALTER TABLE user_organizations DROP CONSTRAINT IF EXISTS check_valid_role;
ALTER TABLE user_organizations
  ADD CONSTRAINT check_valid_role
  CHECK (role IN ('owner', 'admin', 'member', 'guest'));

-- Idem sur organization_invitations.role si CHECK existe
ALTER TABLE organization_invitations DROP CONSTRAINT IF EXISTS check_valid_invitation_role;
ALTER TABLE organization_invitations
  ADD CONSTRAINT check_valid_invitation_role
  CHECK (role IN ('owner', 'admin', 'member', 'guest'));
```

**Workflow MCP recommandé**
1. `mcp__supabase__create_branch` — crée une branche Supabase `feat/guest-role` isolée
2. `mcp__supabase__apply_migration` sur cette branche avec le SQL ci-dessus (nom : `add_guest_role`)
3. `mcp__supabase__execute_sql` sur la branche pour tester :
   ```sql
   INSERT INTO user_organizations (user_id, organization_id, role)
   VALUES ('<uuid test>', '<uuid org>', 'guest'); -- doit réussir
   INSERT INTO user_organizations (user_id, organization_id, role)
   VALUES ('<uuid test>', '<uuid org>', 'bogus'); -- doit échouer par CHECK
   ```
4. Si OK → `mcp__supabase__merge_branch` vers main, sinon `reset_branch` ou corriger et réappliquer
5. Commiter le fichier `.sql` correspondant dans `supabase/migrations/` pour traçabilité git

**Vérifications**
- [ ] T0 a bien identifié le nom exact du CHECK constraint (ne pas présumer `check_valid_role`)
- [ ] Le `execute_sql` de test valide **les deux sens** (insertion valide + insertion rejetée)
- [ ] Aucune vue matérialisée ou fonction ne fait un pattern match exhaustif sur les 3 rôles (grep SQL côté code + `pg_proc` scan)

**Risque** : faible. Migration additive, testable sur branche isolée avant merge.

---

## TÂCHE 2 — DB : RLS & fonctions helper SQL

**Objectif** : garantir qu'un `guest` n'accède qu'aux données nécessaires pour les pages autorisées et qu'il ne peut pas muter ce qu'il ne doit pas.

**Étapes**

### 2.1 — Créer un helper SQL
```sql
CREATE OR REPLACE FUNCTION is_guest(org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND role = 'guest'
  );
$$;
```

### 2.2 — Auditer les RLS existantes
Tables à passer en revue (pour chaque : SELECT / INSERT / UPDATE / DELETE) :
- `products` → guest : SELECT ✅ / INSERT ❌ / UPDATE ❌ (sauf `stock_current` via RPC) / DELETE ❌
- `technicians` → guest : SELECT ✅ / INSERT ❌ / UPDATE ❌ / DELETE ❌
- `stock_movements` → guest : SELECT ✅ (pour historique perso ?) / INSERT ✅ (via RPC) / UPDATE ❌ / DELETE ❌
- `technician_inventory` → guest : SELECT ✅ / UPDATE ✅ (via RPC create_stock_exit)
- `orders` → **à décider** (si /orders interdit, SELECT ❌)
- `user_organizations` → guest : SELECT uniquement sa propre ligne
- `organization_invitations` → guest : ❌ (déjà le cas via policy admin/owner only)
- `organizations` → guest : SELECT uniquement l'org dont il est membre

### 2.3 — Modifier les policies qui supposent "tout membre peut écrire"
Chercher les policies du type `role IN ('owner', 'admin', 'member')` et exclure `guest` explicitement quand l'écriture ne doit pas lui être permise.

### 2.4 — RPCs `create_stock_entry` / `create_stock_exit`
- Vérifier qu'elles ne filtrent pas sur le rôle (actuellement OK)
- Ajouter éventuellement un check `role IN ('owner', 'admin', 'member', 'guest')` explicite pour la défense en profondeur

**Risque** : **élevé**. C'est la tâche la plus sensible — une RLS trop laxiste = fuite de données. Une RLS trop stricte = app cassée pour les rôles existants.

**Workflow MCP recommandé**
1. Tout faire **sur la même branche Supabase** que T1 (pas de merge entre T1 et T2)
2. `mcp__supabase__apply_migration` nommée `add_guest_rls_policies` avec les nouvelles policies
3. `mcp__supabase__execute_sql` pour simuler un `guest` :
   ```sql
   -- Simuler auth.uid() comme un guest
   SET LOCAL ROLE authenticated;
   SET LOCAL request.jwt.claims = '{"sub":"<uuid-du-guest-test>","role":"authenticated"}';

   -- Chaque test retourne ce qui est autorisé ou lève une erreur
   SELECT * FROM products WHERE organization_id = '<org>';    -- doit voir
   INSERT INTO products (...) VALUES (...);                    -- doit être bloqué
   SELECT * FROM organization_invitations;                     -- doit être vide
   SELECT create_stock_entry(...);                             -- doit réussir
   SELECT create_stock_exit(...);                              -- doit réussir
   ```
4. `mcp__supabase__get_advisors` (type=`security`) → comparer avec la baseline T0, aucun nouveau warning ne doit apparaître
5. `mcp__supabase__generate_typescript_types` → régénérer les types TS (utile si on ajoute des fonctions SQL)
6. `mcp__supabase__merge_branch` uniquement quand T2 est verte

**Vérifications**
- [ ] Matrice (table × rôle × opération) écrite dans le PR, chaque cellule confirmée par un `execute_sql`
- [ ] `get_advisors` sans régression
- [ ] Test via l'UI avec un user guest réel après merge de la branche

---

## TÂCHE 3 — Frontend : étendre le type et les helpers

**Objectif** : rendre le rôle `guest` first-class citizen côté TypeScript.

**Prérequis MCP** : lancer `mcp__supabase__generate_typescript_types` **après** le merge de T1+T2 pour que les types générés contiennent `guest` dans les enums si des colonnes typées existent.

**Fichiers**
- `lib/stores/organization-store.ts`
- Fichier de types généré par Supabase (ex: `lib/supabase/database.types.ts` ou équivalent — à confirmer via `list_files` au moment de la tâche)

**Modifications**
```ts
// ligne 9
role: "owner" | "admin" | "member" | "guest"

// ajouter helpers
export function canAccessDashboard(role: Role): boolean {
  return role !== "guest"
}

export function canAccessSettings(role: Role): boolean {
  return role !== "guest"
}

export function canPerformStockMovement(role: Role): boolean {
  return true // tous les rôles connectés peuvent
}

export function isReadOnlyMember(role: Role): boolean {
  return role === "guest"
}
```

Vérifier que les helpers existants (`canInvite`, `canManageMembers`, etc.) retournent bien `false` pour `guest` (ils devraient déjà, car la condition est explicite).

**Risque** : faible. TypeScript guidera les endroits à compléter.

---

## TÂCHE 4 — Frontend : middleware de route par rôle

**Objectif** : rediriger automatiquement un `guest` qui tente d'accéder à une route interdite.

**Choix d'implémentation — deux options, trancher avant de coder :**

### Option A — Middleware Next.js (recommandé)
- Étendre `proxy.ts` (ou créer `middleware.ts`) pour lire le rôle depuis Supabase
- Rediriger côté serveur avant même que la page ne s'affiche
- **Avantage** : sécurité serveur, pas de flash de contenu
- **Inconvénient** : requête DB dans le middleware → latence sur chaque nav

### Option B — Guard client dans le layout `(protected)/layout.tsx`
- Dans le layout, lire `currentOrganization.role` du store
- Si `guest` ET pathname dans la liste interdite → `router.replace('/users')`
- **Avantage** : simple, 0 latence serveur supplémentaire
- **Inconvénient** : flash possible, bypass possible si le code est désactivé

**Recommandation** : **A + B combinés** — A pour la sécurité, B comme filet de sécurité UX.

**Liste des routes à bloquer pour `guest`**
```
/global              → redirect /users
/orders              → redirect /users (à valider)
/settings            → redirect /users
/settings/*          → redirect /users
```

**Risque** : moyen. Attention aux boucles de redirection et au cas où le rôle n'est pas encore chargé.

---

## TÂCHE 5 — Frontend : sidebar dynamique

**Objectif** : masquer les entrées de menu interdites pour `guest`.

**Fichiers**
- `components/layout/sidebar.tsx`
- `lib/routes-config.tsx` (ajouter un champ `allowedRoles` par route)

**Modifications**
```ts
// routes-config.tsx
export type PageRoute = {
  href: string
  label: string
  icon: ...
  allowedRoles?: Role[] // si undefined → tout le monde
}

// Exemple
{ href: "/global", label: "Vue d'ensemble", allowedRoles: ["owner", "admin", "member"] }
{ href: "/users", label: "Techniciens" } // pas de restriction
{ href: "/settings/members", label: "Équipe", allowedRoles: ["owner", "admin"] }
```

Dans `sidebar.tsx`, filtrer avant le `.map()` :
```ts
const visibleRoutes = page_routes.filter(r =>
  !r.allowedRoles || r.allowedRoles.includes(currentRole)
)
```

**Risque** : faible.

---

## TÂCHE 6 — Frontend : UX de l'invitation avec rôle guest

**Objectif** : permettre à un owner/admin de choisir `guest` lors de l'invitation.

**Fichiers**
- `app/(protected)/settings/members/page.tsx` (dialog d'invitation)
- `lib/supabase/queries/organizations.ts` (`inviteUserToOrganization`)
- `supabase/functions/send-invitation-email/index.ts` (template email, si on différencie par rôle)

**Modifications**
- Ajouter `guest` dans le `<Select>` de rôle du dialog d'invitation
- Ajouter un libellé clair : **"Invité — accès restreint (Techniciens + Stock uniquement)"**
- Ajouter un tooltip qui liste les permissions exactes
- Afficher le badge "Invité" dans la liste des membres
- Prévoir la promotion/rétrogradation guest ↔ member via le menu "Modifier le rôle"

**Workflow MCP pour l'edge function (si modifiée)**
1. `mcp__supabase__get_edge_function` name=`send-invitation-email` → récupérer le code actuel
2. Modifier en local
3. `mcp__supabase__deploy_edge_function` → redéployer
4. Tester en déclenchant une invitation `guest` depuis l'UI et vérifier avec `mcp__supabase__get_logs` service=`edge-function`

**Risque** : faible. Purement UX + éventuellement redéploiement edge function.

---

## TÂCHE 7 — Tests

**Objectif** : valider en bout en bout que les restrictions tiennent.

**Scénarios minimum**
1. Inviter un user en `guest` → accepte l'invitation → login → **arrive sur `/users`** (pas sur `/global`)
2. Guest tape `/global` dans l'URL → redirigé vers `/users`
3. Guest tente `POST /rest/v1/products` via curl → `403` par RLS
4. Guest fait un restock via UI → OK
5. Guest fait une sortie vers un technicien → OK
6. Guest voit la sidebar avec uniquement Techniciens et Stock
7. Owner promeut guest → member → le member récupère immédiatement l'accès au dashboard (test du refetch du rôle)
8. Rétrogradation member → guest : vérifier que la session en cours est soit invalidée, soit redirigée au prochain chargement

**Fichiers de tests**
- Ajouter des tests dans le format existant du projet (`vitest.config.ts` présent → tests unitaires possibles)
- Un test e2e manuel documenté dans un fichier (checklist)

**Workflow MCP pour les tests RLS**
- `mcp__supabase__execute_sql` avec `SET LOCAL request.jwt.claims` pour chaque rôle, et rejouer chaque scénario côté DB pure (indépendant du front)
- `mcp__supabase__get_advisors` final pour confirmer 0 régression sécurité
- `mcp__supabase__get_logs` service=`postgres` pour repérer les erreurs RLS silencieuses pendant les tests UI

---

## ORDRE D'EXÉCUTION RECOMMANDÉ

0. **T0** — État réel de la DB via MCP (constat, aucune modif)
1. **T1** — Migration CHECK constraint (sur branche Supabase)
2. **T2** — RLS + helpers SQL (même branche que T1, merge seulement quand T2 passe `get_advisors`)
3. **T3** — Types et helpers TS (après `generate_typescript_types`)
4. **T5** — Sidebar dynamique (visible rapidement, feedback UX)
5. **T4** — Middleware / guard de route (sécurité front)
6. **T6** — UX invitation guest (+ éventuel redeploy edge function)
7. **T7** — Tests et validation finale (UI + `execute_sql` + `get_advisors`)

---

## DÉCISIONS TRANCHÉES

- ✅ Le `guest` a accès à `/orders` (flux de stock) — en plus de `/users`, `/product`, `/stock`
- ✅ Le `guest` voit **tous les mouvements** de l'org (pas uniquement les siens)
- ✅ Les **admins peuvent** promouvoir/rétrograder un guest (↔ member), pas seulement les owners
- ✅ Email d'invitation : même template, juste le mot "Invité" dans le libellé du rôle
- ✅ Guard de route : **Option B seule** (guard client dans le layout `(protected)`). La sécurité data repose sur les RLS ; le guard client est juste UX

### Routes autorisées pour `guest` (liste finale)
```
/users        ✅
/product      ✅
/stock        ✅
/orders       ✅
/global       ❌ redirect /users
/settings/*   ❌ redirect /users
```

---

## ESTIMATION

| Tâche | Effort |
|---|---|
| T0 État DB via MCP | 30 min |
| T1 Migration CHECK | 30 min |
| T2 RLS audit + fixes (branche MCP) | 3-4 h |
| T3 Types/helpers | 1 h |
| T4 Middleware/guard | 2 h |
| T5 Sidebar | 1 h |
| T6 UX invitation | 1-2 h |
| T7 Tests (MCP + UI) | 3-4 h |
| **TOTAL** | **~12-16 h** (1,5 à 2 jours) |

Le MCP ne fait pas gagner énormément de temps sur le chiffrage, mais **réduit drastiquement le risque** sur T1 et T2 grâce au workflow branche isolée + `get_advisors`.
