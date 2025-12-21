# Guide du développeur - Plugin Météo

Ce guide explique comment créer un plugin pour Lumy Home en utilisant le plugin météo comme exemple.

## Structure d'un plugin

Un plugin Lumy Home doit contenir au minimum :

1. **manifest.json** - Métadonnées et configuration du plugin (obligatoire)
2. **Composants React** - Pour l'interface utilisateur (optionnel)
3. **Hooks** - Pour le cycle de vie du plugin (optionnel)

## 1. Manifest.json

Le fichier `manifest.json` est le cœur de votre plugin. Il définit :

### Champs obligatoires

- `name` : Nom unique du plugin (slug, ex: "my-plugin")
- `version` : Version semver (ex: "1.0.0")
- `displayName` : Nom d'affichage
- `description` : Description du plugin
- `lumyVersion` : Version minimale de Lumy Home requise (ex: ">=1.0.0")

### Champs optionnels

- `author` : Auteur du plugin
- `icon` : URL de l'icône
- `repository` : URL du dépôt Git
- `permissions` : Liste des permissions requises
- `configSchema` : Schéma JSON Schema pour la validation de la configuration
- `uiExtensions` : Extensions UI (widgets, pages, composants)
- `automationExtensions` : Extensions d'automatisation
- `hooks` : Hooks du cycle de vie

## 2. Extensions UI

Les extensions UI permettent d'ajouter des éléments à l'interface Lumy Home.

### Types d'extensions

- **widget** : Widget affiché sur le dashboard
- **page** : Page complète accessible via une route
- **component** : Composant réutilisable
- **menu_item** : Élément de menu

### Exemple de widget

```json
{
  "type": "widget",
  "name": "my-widget",
  "displayName": "Mon Widget",
  "componentPath": "./dist/widget.js",
  "menuOrder": 1
}
```

### Composant React

Votre composant doit être exporté comme `default` :

```jsx
import React from 'react';

export default function MyWidget({ config, ...props }) {
  return <div>Mon Widget</div>;
}
```

## 3. Configuration

Définissez un schéma JSON Schema pour valider la configuration :

```json
{
  "configSchema": {
    "type": "object",
    "properties": {
      "apiKey": {
        "type": "string",
        "title": "Clé API",
        "default": ""
      }
    },
    "required": ["apiKey"]
  }
}
```

La configuration est accessible dans vos composants via `props.config`.

## 4. Permissions

Déclarez les permissions nécessaires dans le manifest :

```json
{
  "permissions": [
    "devices:read",
    "automations:create"
  ]
}
```

Liste des permissions autorisées :
- `devices:read`, `devices:write`, `devices:control`
- `automations:read`, `automations:create`, `automations:execute`
- `notifications:send`
- `storage:read`, `storage:write`
- `weather:read`

## 5. Hooks du cycle de vie

Les hooks permettent d'exécuter du code à différents moments :

- `onInit` : Initialisation (une fois)
- `onEnable` : Activation
- `onDisable` : Désactivation
- `onDestroy` : Désinstallation

### Format d'un hook

```javascript
module.exports = async function onInit(context) {
  console.log('Plugin initialisé');
  return { success: true };
};
```

## 6. Build et compilation

Compilez vos composants React en JavaScript :

```bash
npm install
npm run build
```

Les fichiers compilés doivent être dans le dossier `dist/`.

## 7. Installation

1. Créez un fichier ZIP contenant :
   - `manifest.json`
   - Dossier `dist/` avec les fichiers compilés
   - Autres fichiers nécessaires

2. Publiez sur le Lumy Store

3. Installez depuis Lumy Home

## Bonnes pratiques

1. **Validation** : Validez toujours les données d'entrée
2. **Gestion d'erreurs** : Gérez les erreurs gracieusement
3. **Performance** : Optimisez les appels API et la mise en cache
4. **Sécurité** : Ne stockez jamais de secrets dans le code
5. **Documentation** : Documentez votre plugin

## Ressources

- [Documentation complète](https://docs.lumy-home.com/plugins)
- [API des plugins](https://docs.lumy-home.com/plugins/api)
- [Exemples de plugins](https://github.com/lumy-home/plugins)

