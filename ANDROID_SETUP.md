# JexonGo — application Android via Capacitor

## Ce qui a été fait

Comme pour iOS, le jeu (`src/`) n'a pas changé : on a seulement ajouté une coquille Android
autour du build Vite.

- `@capacitor/android` ajouté en devDependency (avec pnpm, comme le reste du projet)
- Dossier `android/` généré : un vrai projet Android Studio (Gradle)
- Deux scripts dans `package.json` :
  - `pnpm run cap:sync:android` → build Vite + copie le jeu dans le projet Android
  - `pnpm run cap:open:android` → ouvre le projet dans Android Studio (s'il est installé)

Les fichiers du jeu copiés dans `android/app/src/main/assets/public/` ne sont pas dans git
(ils sont régénérés par `cap:sync:android`).

## Outils sur ce PC

- Java 21 (Eclipse Temurin) : `D:\android-tools\jdk-21`
- SDK Android déjà présent : `%LOCALAPPDATA%\Android\Sdk`
- Gradle et ses téléchargements : `D:\android-tools\gradle-home` (pour ne pas remplir C:)

## Refaire l'APK de test après un changement du jeu

Dans PowerShell, à la racine du projet :

```powershell
pnpm run cap:sync:android
$env:JAVA_HOME = "D:\android-tools\jdk-21"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = "D:\android-tools\gradle-home"
cd android
.\gradlew.bat assembleDebug
```

L'APK est dans `android\app\build\outputs\apk\debug\app-debug.apk`.

## L'installer sur un téléphone Android

1. Copier `app-debug.apk` sur le téléphone (câble USB, Google Drive, courriel…).
2. L'ouvrir sur le téléphone et accepter « installer des applis de sources inconnues ».
3. L'appli s'appelle JexonGo.

## Ce qui ne marche pas encore dans l'appli

Dans l'appli, le jeu tourne à une adresse interne (`https://localhost`), pas sur jexongo.app :

- **Connexion Google** : Google bloque son bouton à l'intérieur des applis. Il faudra une
  connexion Google « native » (plugin Capacitor), donc modifier le code de connexion.
- **Sauvegardes en ligne et courriels (AVIS)** : le jeu les envoie au serveur de la même
  adresse que la page ; dans l'appli il faudra les envoyer vers https://jexongo.app.

Le jeu lui-même (niveaux, pratique, carnet d'erreurs, sauvegarde sur le téléphone) marche.

## Pour publier sur Google Play (plus tard)

1. Compte Google Play Console (25 $ US, une seule fois).
2. Changer `appId` (`com.jexongo.app`) si besoin, avant la première publication : il ne
   pourra plus changer ensuite.
3. Remplacer l'icône et l'écran de démarrage (actuellement ceux de Capacitor par défaut,
   dans `android/app/src/main/res/`).
4. Créer une clé de signature (keystore) et la garder précieusement : sans elle, plus de
   mise à jour possible.
5. Construire un AAB signé (`.\gradlew.bat bundleRelease`) et l'envoyer dans la Play Console.

Taille : environ 200 Mo, surtout la musique et les images de `assets/`.
