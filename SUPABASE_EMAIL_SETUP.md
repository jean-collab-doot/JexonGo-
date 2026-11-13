# JexonGo — activer la connexion par courriel (Supabase + Resend)

À faire **une seule fois** dans le tableau de bord Supabase (projet JexonGo) et dans Resend.
La clé Resend se met **seulement** dans les réglages SMTP de Supabase : elle n'est jamais
écrite dans le code du jeu ni dans git.

## 1. Noms de joueur uniques (SQL)

Supabase → **SQL Editor** → nouvel onglet → colle tout le fichier
`supabase/migrations/008_player_names.sql` → **Run**.

Ça crée la table `player_names` (un nom par compte, sans tenir compte des majuscules) et
permet les noms de 20 caractères dans le TOP 20. Tant que ce n'est pas fait, le jeu marche
comme avant (les noms ne sont pas vérifiés).

## 2. Clé Resend pour Supabase

1. Resend → **API Keys** → **Create API Key**.
2. Nom : `Supabase SMTP` · Permission : **Sending access** · Domaine : `jexongo.app`.
3. Copie la clé (elle commence par `re_`). Ne la colle nulle part ailleurs qu'à l'étape 3.

## 3. Serveur d'envoi (SMTP) dans Supabase

Supabase → **Authentication** → **Emails** → onglet **SMTP Settings** → **Enable custom SMTP** :

| Champ | Valeur |
|---|---|
| Sender email | `bienvenue@jexongo.app` |
| Sender name | `JexonGo` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la clé Resend de l'étape 2 |

**Save**. Sans ça, Supabase n'envoie les courriels qu'aux membres de ton équipe Supabase.

## 4. Limite d'envoi

Supabase → **Authentication** → **Rate Limits** → « Rate limit for sending emails » :
mets **100** par heure (une classe entière peut créer ses comptes en même temps).

## 5. Activer la connexion par courriel

Supabase → **Authentication** → **Sign In / Providers** → **Email** :

- **Enable Email provider** : activé
- **Require current password when updating** : désactivé (sinon un joueur Google ne peut pas
  se créer de mot de passe)
- **Minimum password length** : `8`
- **Email OTP Length** : `6`
- **Email OTP Expiration** : `3600` (1 heure)

**Save**.

Puis, sur la même page, section **User Signups** :

- **Confirm email** : **activé**. Après « CRÉER MON COMPTE », le joueur reçoit un code à
  6 chiffres (modèle « Confirm signup ») et le tape dans le jeu. Le courriel du compte est
  ainsi vérifié. (Désactivé, le joueur serait connecté tout de suite, sans code.)

**Save changes**.

## 6. Modèles de courriel (un code, pas de lien)

Supabase → **Authentication** → **Emails** → onglet **Templates**. Dans chaque modèle, le
**sujet** va dans le champ **Subject** et le **message** dans **Body** (onglet Source), puis
**Save changes**. Dans l'aperçu, `{{ .Token }}` s'affiche tel quel : dans le vrai courriel, ce
sont les 6 chiffres.

### « Confirm signup » (code de création de compte)

Sujet : `Ton code JexonGo / Your JexonGo code`

Message (onglet Source) :

```html
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;text-align:center;color:#1f2937">
  <h2 style="color:#ff8a00;margin:0 0 12px">JexonGo ✈️</h2>
  <p>Voici ton code pour confirmer ton compte :</p>
  <p style="font-size:34px;font-weight:bold;letter-spacing:8px;margin:18px 0;color:#1f3b73">{{ .Token }}</p>
  <p>Tape-le dans le jeu. Il est valable 1 heure.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0">
  <p style="color:#4b5563">Here is your code to confirm your account. Type it in the game. It is valid for 1 hour.</p>
  <p style="color:#9ca3af;font-size:12px">Tu n'as pas créé de compte ? Ignore ce courriel.<br>Didn't create an account? Ignore this e-mail.</p>
</div>
```

### « Reset password » (mot de passe oublié — toujours utilisé)

Sujet : `Ton code JexonGo pour le mot de passe / Your JexonGo password code`

```html
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;text-align:center;color:#1f2937">
  <h2 style="color:#ff8a00;margin:0 0 12px">JexonGo ✈️</h2>
  <p>Voici ton code pour choisir ton mot de passe :</p>
  <p style="font-size:34px;font-weight:bold;letter-spacing:8px;margin:18px 0;color:#1f3b73">{{ .Token }}</p>
  <p>Tape-le dans le jeu avec ton nouveau mot de passe. Il est valable 1 heure.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0">
  <p style="color:#4b5563">Here is your code to choose your password. Type it in the game with your new password. It is valid for 1 hour.</p>
  <p style="color:#9ca3af;font-size:12px">Tu n'as rien demandé ? Ignore ce courriel, ton mot de passe ne change pas.<br>Didn't ask for this? Ignore this e-mail, your password stays the same.</p>
</div>
```

## 7. Courriel de bienvenue (Resend) : vérifier le webhook

Le courriel « Bienvenue dans JexonGO ✈️ » part de `api/send-welcome.js`, appelé par un
webhook Supabase. Supabase → **Database** → **Webhooks** → ouvre ce webhook et regarde sa
**table** :

- **`saves`** (schéma public) : rien à changer (c'est le cas de JexonGo). Le courriel part à la
  première sauvegarde du compte, juste après la confirmation par le code. Un seul par courriel.
- **`users`** (schéma auth) : coche aussi l'événement **Update** (en plus d'Insert) et
  enregistre. Le jeu envoie alors le courriel au moment où le compte est confirmé : tout de
  suite pour Google, après le code pour un compte par courriel. Jamais une 2e fois, même si le
  joueur ajoute ensuite un mot de passe ou Google.

## C'est prêt

Teste en suivant « Comment tester » dans le message de Claude, ou dans le jeu :
RÉGLAGE → **SE CONNECTER AVEC UN COURRIEL** → **Créer un compte**.
