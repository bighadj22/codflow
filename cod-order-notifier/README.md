# cod-order-notifier

Notifications Telegram en temps réel pour les nouvelles commandes CodFlow.

Un Worker Cloudflare (déclenché **toutes les minutes** par un Cron Trigger)
interroge en **lecture seule** l'API CodFlow, détecte les commandes arrivées
depuis le dernier passage et envoie un message Telegram. L'identifiant des
commandes déjà notifiées est conservé dans un namespace **KV** : aucune
notification en double, même après un redémarrage.

## Garanties

- **Lecture seule** — une seule requête sortante : `GET /api/orders` avec le
  scope `orders:read`. Aucune création / modification / suppression.
- **Pas de doublon** — état persistant dans KV (`state:v1`), survit aux
  redémarrages et redéploiements.
- **Premier lancement silencieux** — au tout premier passage, l'état actuel est
  enregistré **sans envoyer** de notification. Seules les commandes suivantes
  déclenchent une alerte.
- **Aucun secret dans les logs** — les valeurs sensibles viennent de
  `wrangler secret` (production) ou de `.dev.vars` (local, ignoré par Git) et ne
  sont jamais imprimées.
- **Toujours actif** — le Worker Cloudflare tourne indépendamment de votre PC et
  de VS Code.

## Message envoyé

```
🛒 Nouvelle commande
N° : ORD-20260101-0042
Montant total (COD) : 3 500 DZD
Statut : Nouvelle
Créée le : 01/01/2026 13:00
👤 Ahmed Benali · 📍 16 · 🏘 بئر مراد رايس
```

L'heure est affichée en heure algérienne (`Africa/Algiers`).

---

## Étape 1 — Créer le bot Telegram (intervention requise)

1. Dans Telegram, ouvrez **@BotFather**.
2. Envoyez `/newbot`, choisissez un nom, puis un identifiant qui finit par `bot`.
3. BotFather renvoie un jeton : c'est le **`BOT_TOKEN`**
   (`123456789:AA...`). Gardez-le secret.
4. **Démarrez une conversation avec votre bot** : ouvrez-le et envoyez
   `/start`. ⚠️ Un bot ne peut pas écrire le premier à un utilisateur —
   sans ce `/start`, Telegram renvoie `403 chat not found`.
5. Récupérez le **`CHAT_ID`** :
   - *Chat privé* : envoyez `/start` au bot, puis ouvrez dans un navigateur :
     `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates`. La valeur
     `result[0].message.chat.id` est votre `CHAT_ID` (un nombre positif).
   - *Groupe* : ajoutez le bot au groupe, envoyez un message dans le groupe,
     puis faites la même requête `getUpdates`. L'id est **négatif**
     (`-1001234567890`).
   - Alternative simple : écrivez à **@userinfobot**, il renvoie votre id.

## Étape 2 — Créer une clé API en lecture seule

Le notifier ne doit **jamais** utiliser une clé admin. Créez un membre dédié :

1. Dashboard CodFlow → **Équipe / Team** → **Inviter**.
2. Rôle : **staff**. Cochez uniquement la permission **`orders:read`**
   (catégorie Commandes). Ne cochez rien d'autre.
3. Validez : la clé API (`cod_...`) est affichée **une seule fois**. Copiez-la —
   c'est le **`COD_API_KEY`**.
4. (Optionnel) connectez-vous avec ce membre pour changer son mot de passe.

> La clé peut être régénérée à tout moment (Team → *Tourner la clé API*) si elle
> fuite ; l'ancienne est invalidée immédiatement.

## Étape 3 — Configuration locale + test du bot

1. Copiez `.dev.vars.example` vers `.dev.vars` (ignoré par Git) et renseignez :

   ```
   COD_SERVER_URL=https://api.liniadz.com
   COD_API_KEY=cod_...
   TELEGRAM_BOT_TOKEN=123456:AA...
   TELEGRAM_CHAT_ID=123456789
   ```

2. Testez l'envoi Telegram :

   ```sh
   node scripts/send-test.mjs
   ```

   Le script n'imprime jamais les secrets. **Vérifiez la réception sur votre
   téléphone** avant de continuer.

3. Vérifiez la lecture des commandes (dry-run, n'envoie rien) :

   ```sh
   node scripts/dry-run.mjs
   ```

   - 1er appel : `"seeded": true`, `notified: 0` → l'état est enregistré
     silencieusement (les anciennes commandes ne génèrent rien).
   - Appels suivants : `notified` compte les commandes réellement nouvelles.
   - L'état local est stocké dans `.local-state.json` (ignoré par Git) et
     diffère de l'état KV du Worker — supprimez-le pour rejouer un 1er lancement.

## Étape 4 — Déployer le Worker

Le namespace KV et le `wrangler.toml` sont déjà prêts dans ce dossier.

```sh
cd cod-order-notifier

# 1. Secrets — option A, saisie masquée :
npx wrangler secret put COD_API_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID

# 1 bis. Option B, à partir du .dev.vars déjà rempli (rien n'est imprimé) :
node scripts/push-secrets.mjs

# 2. Déploiement (programme le cron toutes les minutes) :
npx wrangler deploy
```

`COD_SERVER_URL` est une variable publique, définie dans `wrangler.toml`
(`[vars]`).

## Étape 5 — Vérifier

- **Journal en direct** :

  ```sh
  npx wrangler tail cod-order-notifier
  ```

  Vous verrez `[notifier] run done seeded=true notified=0` au premier passage
  (mise en veille silencieuse), puis `notified=1` pour chaque nouvelle commande.

- **Test de bout en bout sans commande fictive** : attendez la prochaine
  commande réelle (une commande de test dans votre propre boutique est un vrai
  ordre CodFlow ; ne créez pas de commande factice). Le message doit arriver en
  moins d'une minute.

- **Vérifier l'état / la reprise après incident** : comme l'état vit dans KV,
  supprimer et redéployer le Worker ne provoque aucun doublon.

- **Pré-semer l'état avant l'activation** : si le Worker est déjà déployé sans
  secrets et qu'un démarrage silencieux n'a pas eu lieu, vous pouvez écrire
  directement la baseline des ids déjà connus (la gestion est rejouée au
  déploiement dans `wrangler.toml`) :

  ```sh
  node scripts/seed-worker-state.mjs
  ```

  Pour un dépôt (prise de contrôle) complet, supprimer `state:v1` :
  `npx wrangler kv key delete --binding ORDER_NOTIFY_KV state:v1` — les ids
  existants sont alors re-enregistrés au prochain passage, sans notification,
  et le premier ordre suivant est notifié.

## Exploitation

| Action | Commande |
| --- | --- |
| Voir les logs | `npx wrangler tail cod-order-notifier` |
| Forcer un cycle de test (dev local) | `npx wrangler dev --test-scheduled` puis `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` |
| Lister les crons | `npx wrangler deployments list` |
| Réinitialiser l'état (re-seed silencieux) | `npx wrangler kv key delete --binding ORDER_NOTIFY_KV state:v1` |
| Supprimer le service | `npx wrangler delete cod-order-notifier` |

## Dépannage

- **`403 chat not found`** : vous n'avez pas envoyé `/start` au bot, ou le
  `CHAT_ID` est faux (groupe = id négatif).
- **Aucune notification** : vérifiez `wrangler tail`. Si le log affiche
  `missing configuration`, un secret n'est pas défini.
- **`401` sur l'API** : la clé API est invalide/inactive, ou le scope
  `orders:read` manque. Le membre doit être `active`.
- **Doublons** : ne devrait pas arriver (état KV). Vérifiez que le Worker
  déployé utilise bien le binding `ORDER_NOTIFY_KV`.

## Tests

```sh
cd cod-order-notifier
node --test test/
```

Les tests couvrent la sélection des nouvelles commandes, l'anti-doublon,
le premier lancement silencieux et le format du message.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/index.mjs` | Entrée Worker : `scheduled` (cron) + `fetch` (health) |
| `src/notifier.mjs` | Logique pure (testable) : lecture, sélection, format, envoi |
| `scripts/send-test.mjs` | Envoie un message de test Telegram |
| `scripts/dry-run.mjs` | Simule un cycle en local, sans envoyer |
| `scripts/push-secrets.mjs` | Pousse les secrets de `.dev.vars` vers le Worker |
| `scripts/seed-worker-state.mjs` | Pré-sème l'état KV du Worker (bootstrap des ids connus) |
| `scripts/verify-telegram.mjs` | Liste les dernières commandes reçues par le bot (diagnostic) |
| `wrangler.toml` | Config réelle (ignorée par Git) |
| `wrangler.toml.example` | Modèle à copier |
| `.dev.vars` | Secrets locaux (ignorés par Git) |
| `.dev.vars.example` | Modèle à copier |
