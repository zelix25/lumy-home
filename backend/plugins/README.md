# Guide de développement de plugins pour Lumy Home

Ce guide vous aidera à créer des plugins pour étendre les fonctionnalités de Lumy Home.

## Table des matières

1. [Introduction](#introduction)
2. [Structure d'un plugin](#structure-dun-plugin)
3. [Manifest.json](#manifestjson)
4. [API disponible](#api-disponible)
5. [Hooks et événements](#hooks-et-événements)
6. [Permissions](#permissions)
7. [Configuration](#configuration)
8. [Exemples](#exemples)
9. [Bonnes pratiques](#bonnes-pratiques)
10. [Publication](#publication)

## Introduction

Les plugins permettent d'étendre les fonctionnalités de Lumy Home en ajoutant :
- De nouvelles intégrations
- Des automations personnalisées
- Des interfaces utilisateur
- Des fonctionnalités métier spécifiques

### Prérequis

- Connaissance de JavaScript/TypeScript
- Compréhension de base de Node.js
- Accès à l'API Lumy Home

## Structure d'un plugin

Un plugin est un package contenant :

```
my-plugin/
├── manifest.json          # Métadonnées du plugin (requis)
├── index.js               # Point d'entrée principal (optionnel)
├── hooks/                 # Handlers d'événements (optionnel)
│   ├── device-update.js
│   └── automation-trigger.js
├── ui/                    # Composants UI (optionnel)
│   └── components/
└── README.md              # Documentation du plugin
```

## Manifest.json

Le fichier `manifest.json` est le cœur de votre plugin. Il définit toutes les métadonnées et configurations.

### Structure complète

```json
{
  "name": "my-plugin",
  "displayName": "Mon Plugin",
  "version": "1.0.0",
  "description": "Description de mon plugin",
  "author": "Votre Nom",
  "icon": "https://example.com/icon.png",
  "repository": "https://github.com/user/my-plugin",
  "lumyVersion": "^1.0.0",
  "category": "automation",
  "tags": ["example", "demo"],
  "dependencies": {
    "other-plugin": "^1.0.0"
  },
  "permissions": [
    "read:devices",
    "control:devices"
  ],
  "configSchema": {
    "type": "object",
    "properties": {
      "apiKey": {
        "type": "string",
        "title": "Clé API",
        "description": "Votre clé API"
      },
      "enabled": {
        "type": "boolean",
        "title": "Activé",
        "default": true
      }
    },
    "required": ["apiKey"]
  },
  "main": "index.js",
  "hooks": {
    "device:update": "hooks/device-update.js",
    "automation:triggered": "hooks/automation-trigger.js"
  },
  "metadata": {
    "hookPriorities": {
      "device:update": 50,
      "automation:triggered": 100
    },
    "screenshots": [
      "https://example.com/screenshot1.png"
    ],
    "documentation": "https://example.com/docs"
  }
}
```

### Champs requis

- `name` : Nom unique du plugin (minuscules, tirets, underscores uniquement)
- `displayName` : Nom d'affichage
- `version` : Version au format semver (ex: "1.0.0")

### Champs optionnels

- `description` : Description du plugin
- `author` : Auteur du plugin
- `icon` : URL ou chemin vers l'icône
- `repository` : URL du repository
- `lumyVersion` : Version minimale de Lumy Home requise (ex: "^1.0.0")
- `category` : Catégorie (automation, integration, ui, security, weather, entertainment, utility, other)
- `tags` : Tags pour la recherche
- `dependencies` : Dépendances vers d'autres plugins
- `permissions` : Permissions requises
- `configSchema` : Schéma de configuration (JSON Schema)
- `main` : Point d'entrée principal
- `hooks` : Handlers d'événements
- `metadata` : Métadonnées supplémentaires

## API disponible

### API des appareils

```javascript
// Lire la liste des appareils
const devices = await lumy.devices.getAll();

// Lire un appareil spécifique
const device = await lumy.devices.get(deviceId);

// Contrôler un appareil
await lumy.devices.control(deviceId, {
  on: true,
  brightness: 100
});
```

### API des automations

```javascript
// Lire les automations
const automations = await lumy.automations.getAll();

// Créer une automation
const automation = await lumy.automations.create({
  name: "Mon automation",
  trigger: { type: "MOTION", deviceId: "..." },
  action: { type: "TURN_ON", deviceId: "..." }
});
```

### API des pièces

```javascript
// Lire les pièces
const rooms = await lumy.rooms.getAll();

// Lire une pièce spécifique
const room = await lumy.rooms.get(roomId);
```

### API de stockage

```javascript
// Stocker des données
await lumy.storage.set('key', { data: 'value' });

// Récupérer des données
const data = await lumy.storage.get('key');

// Supprimer des données
await lumy.storage.delete('key');
```

### API de notifications

```javascript
// Envoyer une notification
await lumy.notifications.send({
  title: "Titre",
  message: "Message",
  level: "info" // info, warning, error, success
});
```

### API de logs

```javascript
// Logger des messages
lumy.logger.debug("Message de debug");
lumy.logger.info("Message d'information");
lumy.logger.warn("Message d'avertissement");
lumy.logger.error("Message d'erreur", error);
```

## Notifications

Les plugins peuvent envoyer des notifications aux utilisateurs via l'API de notifications.

### Envoyer une notification

```javascript
await lumy.notifications.send({
  title: "Alerte température",
  message: "La température dépasse 25°C",
  level: "warning"
});
```

### Options de notification

- `title` (string, requis) : Titre de la notification
- `message` (string, requis) : Message de la notification
- `level` (string, optionnel) : Niveau (`info`, `success`, `warning`, `error`) - défaut: `info`
- `actions` (array, optionnel) : Actions disponibles (boutons)
- `priority` (number, optionnel) : Priorité (0 = normal, plus élevé = plus important)
- `expiresAt` (Date, optionnel) : Date d'expiration de la notification
- `metadata` (object, optionnel) : Métadonnées supplémentaires (icône, son, etc.)
- `userId` (string, optionnel) : ID de l'utilisateur cible (si null, tous les utilisateurs)

### Exemple avec actions

```javascript
await lumy.notifications.send({
  title: "Mise à jour disponible",
  message: "Une nouvelle version du plugin est disponible",
  level: "info",
  actions: [
    { label: "Mettre à jour", action: "update", data: { version: "1.1.0" } },
    { label: "Plus tard", action: "dismiss" }
  ],
  priority: 5
});
```

### Permission requise

Pour envoyer des notifications, votre plugin doit demander la permission `notifications:send` dans son `manifest.json` :

```json
{
  "permissions": ["notifications:send"]
}
```

## Hooks et événements

Les hooks permettent à votre plugin de réagir aux événements du système.

### Types d'événements disponibles

#### Événements d'appareils
- `device:update` - Un appareil a été mis à jour
- `device:state_change` - L'état d'un appareil a changé
- `device:added` - Un nouvel appareil a été ajouté
- `device:removed` - Un appareil a été supprimé
- `device:online` - Un appareil est passé en ligne
- `device:offline` - Un appareil est passé hors ligne

#### Événements d'automations
- `automation:triggered` - Une automation a été déclenchée
- `automation:executed` - Une automation a été exécutée
- `automation:created` - Une automation a été créée
- `automation:updated` - Une automation a été mise à jour
- `automation:deleted` - Une automation a été supprimée

#### Événements système
- `system:startup` - Démarrage du système
- `system:shutdown` - Arrêt du système
- `plugin:enabled` - Un plugin a été activé
- `plugin:disabled` - Un plugin a été désactivé

### Exemple de handler

```javascript
// hooks/device-update.js
module.exports = async function(event) {
  const { type, timestamp, data, source } = event;
  
  // data contient les informations de l'appareil
  const { deviceId, deviceName, state } = data;
  
  // Votre logique personnalisée
  if (state.on && state.brightness > 80) {
    await lumy.notifications.send({
      title: "Lumière forte détectée",
      message: `La lumière ${deviceName} est allumée à ${state.brightness}%`,
      level: "info"
    });
  }
};
```

### Priorités des hooks

Les hooks peuvent avoir des priorités pour contrôler l'ordre d'exécution :

```json
{
  "metadata": {
    "hookPriorities": {
      "device:update": 50,  // Exécuté en premier (priorité basse)
      "automation:triggered": 100  // Exécuté après (priorité haute)
    }
  }
}
```

## Permissions

Les permissions définissent ce que votre plugin peut faire. Voici les permissions disponibles :

### Permissions de lecture
- `read:devices` - Lire la liste des appareils
- `read:device_state` - Lire l'état d'un appareil
- `read:rooms` - Lire la liste des pièces
- `read:automations` - Lire les automations
- `read:settings` - Lire les paramètres
- `read:weather` - Lire les données météo
- `read:history` - Lire l'historique

### Permissions d'écriture
- `write:devices` - Modifier les appareils
- `control:devices` - Contrôler les appareils
- `write:automations` - Créer/modifier des automations
- `write:settings` - Modifier les paramètres
- `write:rooms` - Modifier les pièces

### Permissions système
- `system:restart` - Redémarrer le système
- `system:shutdown` - Arrêter le système
- `system:update` - Mettre à jour le système

### Permissions réseau
- `network:http` - Faire des requêtes HTTP
- `network:mqtt` - Publier/s'abonner à MQTT
- `network:websocket` - Utiliser WebSocket

### Permissions de stockage
- `storage:read` - Lire le stockage
- `storage:write` - Écrire dans le stockage

### Permissions de notification
- `notifications:send` - Envoyer des notifications

### Permissions d'interface
- `ui:add_pages` - Ajouter des pages à l'interface
- `ui:add_components` - Ajouter des composants

### Permissions avancées
- `execute:scripts` - Exécuter des scripts
- `access:filesystem` - Accéder au système de fichiers

## Configuration

La configuration permet aux utilisateurs de personnaliser le comportement de votre plugin.

### Schéma de configuration

Utilisez JSON Schema pour définir votre schéma :

```json
{
  "configSchema": {
    "type": "object",
    "properties": {
      "apiKey": {
        "type": "string",
        "title": "Clé API",
        "description": "Votre clé API pour le service externe",
        "minLength": 10
      },
      "refreshInterval": {
        "type": "number",
        "title": "Intervalle de rafraîchissement",
        "description": "En secondes",
        "minimum": 1,
        "maximum": 3600,
        "default": 60
      },
      "enableNotifications": {
        "type": "boolean",
        "title": "Activer les notifications",
        "default": true
      },
      "endpoint": {
        "type": "string",
        "format": "uri",
        "title": "URL du endpoint",
        "default": "https://api.example.com"
      }
    },
    "required": ["apiKey"],
    "additionalProperties": false
  }
}
```

### Accéder à la configuration

Dans votre code :

```javascript
// Dans le point d'entrée principal
module.exports = {
  async init(config) {
    // config contient la configuration de l'utilisateur
    const apiKey = config.apiKey;
    const interval = config.refreshInterval || 60;
    
    // Utiliser la configuration
  }
};
```

## Exemples

### Exemple 1 : Plugin simple avec hook

```javascript
// hooks/device-update.js
module.exports = async function(event) {
  const { data } = event;
  
  // Logger l'événement
  lumy.logger.info(`Appareil ${data.deviceName} mis à jour`);
  
  // Envoyer une notification si la température est élevée
  if (data.state && data.state.temperature > 25) {
    await lumy.notifications.send({
      title: "Température élevée",
      message: `La température dans ${data.deviceName} est de ${data.state.temperature}°C`,
      level: "warning"
    });
  }
};
```

### Exemple 2 : Plugin avec point d'entrée

```javascript
// index.js
module.exports = {
  async init(config) {
    // Initialisation du plugin
    lumy.logger.info('Plugin initialisé avec la configuration:', config);
    
    // Démarrer un service périodique
    setInterval(async () => {
      // Votre logique périodique
      await this.checkStatus();
    }, config.refreshInterval * 1000);
  },
  
  async checkStatus() {
    // Vérifier le statut
    const devices = await lumy.devices.getAll();
    lumy.logger.debug(`Nombre d'appareils: ${devices.length}`);
  },
  
  async destroy() {
    // Nettoyage lors de la désactivation
    lumy.logger.info('Plugin désactivé');
  }
};
```

### Exemple 3 : Plugin avec dépendance

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "dependencies": {
    "weather-plugin": "^1.0.0"
  }
}
```

Le plugin `weather-plugin` sera automatiquement installé si nécessaire.

## Gestion des erreurs

Lumy Home inclut un système de gestion des erreurs robuste pour les plugins. Les erreurs sont automatiquement capturées, enregistrées et isolées pour éviter qu'un plugin défaillant n'affecte le système.

### Types d'erreurs

- **Runtime** : Erreurs d'exécution générales
- **Permission** : Erreurs liées aux permissions
- **Validation** : Erreurs de validation de données
- **Network** : Erreurs réseau
- **Timeout** : Délais d'attente dépassés
- **Memory** : Problèmes de mémoire
- **Unknown** : Erreurs non catégorisées

### Niveaux de sévérité

- **Low** : Erreurs mineures, non critiques
- **Medium** : Erreurs modérées
- **High** : Erreurs importantes
- **Critical** : Erreurs critiques nécessitant une attention immédiate

### Circuit Breaker

Si un plugin génère plus de 10 erreurs par minute, il sera automatiquement désactivé pour protéger le système. Le circuit breaker peut être réinitialisé manuellement.

### Bonnes pratiques

### 1. Gestion des erreurs

Toujours gérer les erreurs gracieusement :

```javascript
module.exports = async function(event) {
  try {
    // Votre code
  } catch (error) {
    lumy.logger.error('Erreur dans le hook:', error);
    // Ne pas faire échouer le système
  }
};
```

### 2. Logging

Utilisez les niveaux de log appropriés :

```javascript
lumy.logger.debug('Information de debug');  // Détails techniques
lumy.logger.info('Information générale');    // Événements normaux
lumy.logger.warn('Avertissement');           // Problèmes non critiques
lumy.logger.error('Erreur', error);          // Erreurs critiques
```

### 3. Performance

- Évitez les opérations bloquantes
- Utilisez des timeouts pour les opérations longues
- Limitez la fréquence des appels API

### 4. Sécurité

- Ne stockez jamais de secrets en clair
- Validez toutes les entrées utilisateur
- Utilisez uniquement les permissions nécessaires

### 5. Compatibilité

- Spécifiez toujours `lumyVersion` dans le manifest
- Testez avec différentes versions de Lumy Home
- Documentez les breaking changes

## Publication

### Préparation

1. **Versionner votre plugin** : Utilisez le versioning semver
2. **Tester** : Testez votre plugin dans différents scénarios
3. **Documenter** : Créez un README.md complet
4. **Packager** : Créez une archive `.tar.gz` avec votre plugin

### Structure du package

```
my-plugin-1.0.0.tar.gz
├── manifest.json
├── index.js
├── hooks/
└── README.md
```

### Publication dans le Lumy Store

1. Créez un compte développeur
2. Soumettez votre plugin pour review
3. Une fois approuvé, votre plugin sera disponible dans le store

### Installation locale

Pour tester localement :

```bash
# Depuis l'interface Lumy Home
# Allez dans Plugins > Installer depuis URL
# Entrez le chemin local : file:///path/to/my-plugin.tar.gz
```

## Ressources

- [Documentation API complète](./API.md)
- [Exemples de plugins](./examples/)
- [Forum de la communauté](https://community.lumy.home)
- [Support développeur](mailto:dev@lumy.home)

## Support

Pour toute question ou problème :
- Consultez la [FAQ](./FAQ.md)
- Ouvrez une issue sur GitHub
- Contactez le support développeur
