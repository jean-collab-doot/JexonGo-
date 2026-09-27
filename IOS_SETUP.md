# JexonGo — App Store (iOS) via Capacitor

## Ce qui a été fait

Ton jeu HTML/CSS/JS n'a pas été touché — aucune ligne de `src/` n'a changé. On a seulement
ajouté une coquille native autour de ton build existant :

- `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios` ajoutés en devDependencies
- `capacitor.config.json` créé à la racine (appId `com.jexongo.app`, webDir `dist`)
- Dossier `ios/` généré — un vrai projet Xcode (utilise Swift Package Manager, pas
  CocoaPods, donc pas de dépendance Ruby à gérer)
- Deux scripts ajoutés dans `package.json` :
  - `npm run cap:sync` → build Vite + copie le résultat dans le projet iOS
  - `npm run cap:open:ios` → ouvre le projet dans Xcode

Le dossier `ios/App/App/public/` a été vidé volontairement avant l'envoi (il contenait une
copie de build incomplète faite dans un environnement sans tous tes assets). La toute
première fois que tu ouvres ce projet chez toi, il faut le régénérer avec tes vrais fichiers.

## Ce qu'il te reste à faire (nécessite un Mac)

Construire, signer et publier une appli iOS exige Xcode, qui ne tourne que sur macOS.
Ça ne se contourne pas, peu importe le framework utilisé (Capacitor, Flutter, Unity...).
Si tu n'as pas de Mac sous la main, les options courantes sont : emprunter/acheter un Mac,
ou utiliser un service de build iOS dans le cloud (Codemagic, Ionic Appflow, GitHub Actions
avec un runner macOS) qui compile et signe l'appli sans que tu aies besoin de matériel Apple.

Étapes une fois sur un Mac (ou un CI macOS) :

1. `pnpm install` (ou `npm install`) à la racine du projet
2. `npm run cap:sync` — build le jeu et régénère `ios/App/App/public` avec tes vrais assets
3. `npm run cap:open:ios` — ouvre `ios/App/App.xcworkspace` dans Xcode
4. Dans Xcode : choisir ton équipe de développeur Apple (nécessite un compte Apple Developer
   Program, 99 $ US/an) sous Signing & Capabilities
5. Remplacer l'icône d'appli et l'écran de lancement par défaut dans
   `ios/App/App/Assets.xcassets` (actuellement des placeholders Capacitor génériques)
6. Lancer sur un simulateur ou un appareil réel pour tester
7. Archiver (`Product → Archive`) puis soumettre via App Store Connect

## Pour la monétisation via Apple

Vendre des achats intégrés (abonnement JEXONGO Famille, etc.) sur iOS doit passer par le
système de paiement d'Apple (StoreKit), pas par ton système web actuel. Le plus simple est
un plugin comme `@capacitor-community/in-app-purchases` ou un service comme RevenueCat,
qui gère StoreKit + Google Play Billing avec une seule intégration. C'est une étape séparée,
à faire une fois que l'appli tourne sur un appareil.

## Bundle ID

`com.jexongo.app` est un placeholder. Change-le dans `capacitor.config.json` (`appId`) et
dans Xcode (Signing & Capabilities → Bundle Identifier) pour quelque chose que tu possèdes
vraiment — idéalement basé sur ton propre nom de domaine si tu en as un
(ex. `app.jexongo.jexongo`), avant de créer la fiche de l'appli dans App Store Connect.
