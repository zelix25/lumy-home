# Plugin Météo - Exemple pour développeurs

Ce plugin météo sert d'exemple complet pour les développeurs tiers qui souhaitent créer des plugins pour Lumy Home.

## Structure du plugin

```
weather/
├── manifest.json          # Métadonnées du plugin (requis)
├── README.md              # Documentation
├── package.json           # Dépendances npm (optionnel)
├── src/                   # Code source
│   ├── components/        # Composants React
│   │   ├── WeatherWidget.jsx
│   │   └── WeatherPage.jsx
│   ├── hooks/            # Hooks du cycle de vie
│   │   ├── onInit.js
│   │   ├── onEnable.js
│   │   └── onDisable.js
│   └── utils/            # Utilitaires
│       └── weatherApi.js
└── dist/                 # Fichiers compilés (générés)
    ├── widget.js
    ├── page.js
    └── hooks/
```

## Manifest.json

Le fichier `manifest.json` est le cœur du plugin. Il contient :

- **Métadonnées** : nom, version, description, auteur
- **Configuration** : schéma JSON Schema pour la validation
- **Permissions** : liste des permissions requises
- **Extensions UI** : widgets, pages, composants
- **Extensions d'automatisation** : triggers, conditions, actions
- **Hooks** : points d'extension du cycle de vie

## Composants React

Les composants doivent être exportés comme `default` et être compatibles avec React 18+.

### Exemple de composant widget

```jsx
// src/components/WeatherWidget.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

export default function WeatherWidget({ config, showForecast = true }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Charger les données météo
    fetchWeatherData();
  }, [config]);

  const fetchWeatherData = async () => {
    // Implémentation de la récupération des données
  };

  if (loading) {
    return <Typography>Chargement...</Typography>;
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6">Météo - {config.city}</Typography>
        {/* Contenu du widget */}
      </CardContent>
    </Card>
  );
}
```

## Hooks du cycle de vie

Les hooks permettent d'exécuter du code à différents moments :

- `onInit` : Lors de l'initialisation du plugin
- `onEnable` : Lors de l'activation
- `onDisable` : Lors de la désactivation
- `onDestroy` : Lors de la désinstallation

### Exemple de hook

```javascript
// src/hooks/onInit.js
module.exports = async function onInit(context) {
  console.log('Plugin météo initialisé');
  // Initialiser les services, configurer les listeners, etc.
};
```

## Configuration

Le plugin peut avoir une configuration validée par JSON Schema. Les valeurs sont accessibles via `config` dans les composants.

## Permissions

Les permissions doivent être déclarées dans le manifest et validées par le système. Liste des permissions autorisées :

- `weather:read` - Lire les données météo
- `devices:read` - Lire les appareils
- `automations:create` - Créer des automatisations
- etc.

## Installation

1. Créer un fichier ZIP du plugin
2. Publier sur le Lumy Store
3. Installer depuis Lumy Home via l'interface

## Développement

Pour développer localement :

1. Créer le plugin dans `Lumy-Plugins/weather`
2. Compiler les composants React en JavaScript
3. Tester avec l'installation manuelle
4. Publier sur le store

## Ressources

- [Documentation des plugins](https://docs.lumy-home.com/plugins)
- [API des plugins](https://docs.lumy-home.com/plugins/api)
- [Exemples de plugins](https://github.com/lumy-home/plugins)

