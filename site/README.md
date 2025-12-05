# Exo Home - Site Web

Site web marketing pour Exo Home, construit avec React, Vite et Material-UI, appliquant le style scandinave épuré.

## 🚀 Démarrage rapide

### Installation

```bash
npm install
```

### Développement

```bash
npm run dev
```

Le site sera accessible sur `http://localhost:3000`

### Build de production

```bash
npm run build
```

Les fichiers de production seront générés dans le dossier `dist/`.

## 🎨 Style

Le site applique strictement le **style scandinave** défini dans le guide de style :

- **Palette de couleurs** : Beige/gris clair (#F7F7F5) pour le fond, vert-gris nordique (#86A6A0) pour les accents
- **Typographie** : Inter, poids 400/500/600/700
- **Composants** : Cards avec bordures arrondies (8px), ombres douces
- **Animations** : Douces, 150-200ms, ease-out
- **Espacement** : Beaucoup d'espace blanc, design épuré

## 📁 Structure

```
site/
├── src/
│   ├── components/     # Composants réutilisables
│   │   ├── Layout.tsx
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── ScandiCard.tsx
│   ├── pages/          # Pages du site
│   │   ├── HomePage.tsx
│   │   ├── FeaturesPage.tsx
│   │   └── AboutPage.tsx
│   ├── theme/          # Configuration du thème Material-UI
│   │   └── scandinavianTheme.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
└── package.json
```

## 🎯 Contenu

Le site suit le framework **StoryBrand** :

1. **Le Héros** : L'utilisateur novice en domotique
2. **Le Problème** : La domotique est compliquée
3. **Le Guide** : Exo Home simplifie tout
4. **Le Plan** : 3 étapes simples
5. **L'Appel à l'action** : "Commencez en 2 minutes"
6. **Le Succès** : Maison intelligente automatisée

## 🛠 Technologies

- **React 18** : Framework UI
- **Vite** : Build tool rapide
- **Material-UI (MUI)** : Composants UI
- **TypeScript** : Typage statique
- **React Router** : Navigation

## 📝 Notes

- Le site est actuellement statique (sans backend)
- Le thème est configuré en mode clair par défaut
- Tous les textes suivent le ton défini dans le guide de style : simple, clair, accessible

