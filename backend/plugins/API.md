# API de développement pour les plugins Lumy Home

Cette documentation décrit l'API complète disponible pour les développeurs de plugins.

## Table des matières

1. [API Globale](#api-globale)
2. [API des Appareils](#api-des-appareils)
3. [API des Automations](#api-des-automations)
4. [API des Pièces](#api-des-pièces)
5. [API de Stockage](#api-de-stockage)
6. [API de Notifications](#api-de-notifications)
7. [API de Logs](#api-de-logs)
8. [API Météo](#api-météo)
9. [API Système](#api-système)

## API Globale

L'objet global `lumy` est injecté dans tous les contextes d'exécution de plugins.

```javascript
// Accès aux différentes APIs
const devices = lumy.devices;
const automations = lumy.automations;
const rooms = lumy.rooms;
const storage = lumy.storage;
const notifications = lumy.notifications;
const logger = lumy.logger;
const weather = lumy.weather;
const system = lumy.system;
```

## API des Appareils

### `lumy.devices.getAll()`

Récupère tous les appareils.

**Retourne** : `Promise<Device[]>`

```javascript
const devices = await lumy.devices.getAll();
```

### `lumy.devices.get(deviceId)`

Récupère un appareil spécifique.

**Paramètres** :
- `deviceId` (string) : ID de l'appareil

**Retourne** : `Promise<Device>`

```javascript
const device = await lumy.devices.get('0x1234567890abcdef');
```

### `lumy.devices.getByRoom(roomId)`

Récupère tous les appareils d'une pièce.

**Paramètres** :
- `roomId` (string) : ID de la pièce

**Retourne** : `Promise<Device[]>`

```javascript
const devices = await lumy.devices.getByRoom('room-123');
```

### `lumy.devices.getByType(type)`

Récupère tous les appareils d'un type spécifique.

**Paramètres** :
- `type` (string) : Type d'appareil (ex: "light", "switch", "sensor")

**Retourne** : `Promise<Device[]>`

```javascript
const lights = await lumy.devices.getByType('light');
```

### `lumy.devices.control(deviceId, command)`

Contrôle un appareil.

**Paramètres** :
- `deviceId` (string) : ID de l'appareil
- `command` (object) : Commande à envoyer

**Retourne** : `Promise<void>`

```javascript
// Allumer une lumière
await lumy.devices.control('0x1234', {
  on: true,
  brightness: 100
});

// Changer la couleur
await lumy.devices.control('0x1234', {
  color: { r: 255, g: 0, b: 0 }
});

// Contrôler un volet
await lumy.devices.control('0x5678', {
  position: 50  // 0-100
});
```

### `lumy.devices.getState(deviceId)`

Récupère l'état actuel d'un appareil.

**Paramètres** :
- `deviceId` (string) : ID de l'appareil

**Retourne** : `Promise<DeviceState>`

```javascript
const state = await lumy.devices.getState('0x1234');
console.log(state.on, state.brightness);
```

## API des Automations

### `lumy.automations.getAll()`

Récupère toutes les automations.

**Retourne** : `Promise<Automation[]>`

```javascript
const automations = await lumy.automations.getAll();
```

### `lumy.automations.get(automationId)`

Récupère une automation spécifique.

**Paramètres** :
- `automationId` (string) : ID de l'automation

**Retourne** : `Promise<Automation>`

```javascript
const automation = await lumy.automations.get('auto-123');
```

### `lumy.automations.create(automation)`

Crée une nouvelle automation.

**Paramètres** :
- `automation` (object) : Configuration de l'automation

**Retourne** : `Promise<Automation>`

```javascript
const automation = await lumy.automations.create({
  name: "Allumer la lumière au mouvement",
  trigger: {
    type: "MOTION",
    deviceId: "0x1234"
  },
  action: {
    type: "TURN_ON",
    deviceId: "0x5678",
    duration: 300  // 5 minutes
  }
});
```

### `lumy.automations.update(automationId, automation)`

Met à jour une automation.

**Paramètres** :
- `automationId` (string) : ID de l'automation
- `automation` (object) : Nouvelles données

**Retourne** : `Promise<Automation>`

```javascript
await lumy.automations.update('auto-123', {
  name: "Nouveau nom"
});
```

### `lumy.automations.delete(automationId)`

Supprime une automation.

**Paramètres** :
- `automationId` (string) : ID de l'automation

**Retourne** : `Promise<void>`

```javascript
await lumy.automations.delete('auto-123');
```

### `lumy.automations.enable(automationId)`

Active une automation.

**Paramètres** :
- `automationId` (string) : ID de l'automation

**Retourne** : `Promise<void>`

```javascript
await lumy.automations.enable('auto-123');
```

### `lumy.automations.disable(automationId)`

Désactive une automation.

**Paramètres** :
- `automationId` (string) : ID de l'automation

**Retourne** : `Promise<void>`

```javascript
await lumy.automations.disable('auto-123');
```

## API des Pièces

### `lumy.rooms.getAll()`

Récupère toutes les pièces.

**Retourne** : `Promise<Room[]>`

```javascript
const rooms = await lumy.rooms.getAll();
```

### `lumy.rooms.get(roomId)`

Récupère une pièce spécifique.

**Paramètres** :
- `roomId` (string) : ID de la pièce

**Retourne** : `Promise<Room>`

```javascript
const room = await lumy.rooms.get('room-123');
```

### `lumy.rooms.create(room)`

Crée une nouvelle pièce.

**Paramètres** :
- `room` (object) : Configuration de la pièce

**Retourne** : `Promise<Room>`

```javascript
const room = await lumy.rooms.create({
  name: "Salon",
  icon: "sofa"
});
```

### `lumy.rooms.update(roomId, room)`

Met à jour une pièce.

**Paramètres** :
- `roomId` (string) : ID de la pièce
- `room` (object) : Nouvelles données

**Retourne** : `Promise<Room>`

```javascript
await lumy.rooms.update('room-123', {
  name: "Nouveau nom"
});
```

### `lumy.rooms.delete(roomId)`

Supprime une pièce.

**Paramètres** :
- `roomId` (string) : ID de la pièce

**Retourne** : `Promise<void>`

```javascript
await lumy.rooms.delete('room-123');
```

## API de Stockage

Le stockage permet de persister des données spécifiques à votre plugin.

### `lumy.storage.set(key, value)`

Stocke une valeur.

**Paramètres** :
- `key` (string) : Clé de stockage
- `value` (any) : Valeur à stocker (sera sérialisée en JSON)

**Retourne** : `Promise<void>`

```javascript
await lumy.storage.set('lastUpdate', new Date().toISOString());
await lumy.storage.set('userPreferences', { theme: 'dark' });
```

### `lumy.storage.get(key)`

Récupère une valeur.

**Paramètres** :
- `key` (string) : Clé de stockage

**Retourne** : `Promise<any>`

```javascript
const lastUpdate = await lumy.storage.get('lastUpdate');
const preferences = await lumy.storage.get('userPreferences');
```

### `lumy.storage.delete(key)`

Supprime une valeur.

**Paramètres** :
- `key` (string) : Clé de stockage

**Retourne** : `Promise<void>`

```javascript
await lumy.storage.delete('lastUpdate');
```

### `lumy.storage.getAll()`

Récupère toutes les clés stockées par le plugin.

**Retourne** : `Promise<string[]>`

```javascript
const keys = await lumy.storage.getAll();
```

### `lumy.storage.clear()`

Supprime toutes les données du plugin.

**Retourne** : `Promise<void>`

```javascript
await lumy.storage.clear();
```

## API de Notifications

### `lumy.notifications.send(notification)`

Envoie une notification.

**Paramètres** :
- `notification` (object) : Configuration de la notification
  - `title` (string) : Titre de la notification
  - `message` (string) : Message
  - `level` (string) : Niveau (info, warning, error, success)
  - `actions` (array, optionnel) : Actions disponibles
  - `priority` (number, optionnel) : Priorité (0 = normal, plus élevé = plus important)
  - `expiresAt` (Date, optionnel) : Date d'expiration
  - `metadata` (object, optionnel) : Métadonnées supplémentaires (icône, son, etc.)
  - `userId` (string, optionnel) : ID de l'utilisateur cible (si null, tous les utilisateurs)

**Retourne** : `Promise<Notification>`

```javascript
// Notification simple
await lumy.notifications.send({
  title: "Alerte température",
  message: "La température dépasse 25°C",
  level: "warning"
});

// Notification avec actions
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

// Notification avec expiration
await lumy.notifications.send({
  title: "Maintenance programmée",
  message: "Le système sera en maintenance demain à 2h",
  level: "info",
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 heures
});
```

### `lumy.notifications.getAll(filters)`

Récupère toutes les notifications.

**Paramètres** :
- `filters` (object, optionnel) : Filtres
  - `level` (string, optionnel) : Filtrer par niveau
  - `status` (string, optionnel) : Filtrer par statut
  - `unreadOnly` (boolean, optionnel) : Uniquement les non lues

**Retourne** : `Promise<Notification[]>`

```javascript
const notifications = await lumy.notifications.getAll({ unreadOnly: true });
```

### `lumy.notifications.getUnreadCount()`

Récupère le nombre de notifications non lues.

**Retourne** : `Promise<number>`

```javascript
const count = await lumy.notifications.getUnreadCount();
```

### `lumy.notifications.markAsRead(id)`

Marque une notification comme lue.

**Paramètres** :
- `id` (string) : ID de la notification

**Retourne** : `Promise<Notification>`

```javascript
await lumy.notifications.markAsRead(notificationId);
```

### `lumy.notifications.markAllAsRead()`

Marque toutes les notifications comme lues.

**Retourne** : `Promise<number>` (nombre de notifications marquées)

```javascript
const count = await lumy.notifications.markAllAsRead();
```

## API de Logs

### `lumy.logger.debug(message, ...args)`

Log un message de debug.

```javascript
lumy.logger.debug('Valeur actuelle:', value);
```

### `lumy.logger.info(message, ...args)`

Log un message d'information.

```javascript
lumy.logger.info('Plugin démarré');
```

### `lumy.logger.warn(message, ...args)`

Log un avertissement.

```javascript
lumy.logger.warn('Configuration manquante');
```

### `lumy.logger.error(message, error, ...args)`

Log une erreur.

```javascript
try {
  // Code
} catch (error) {
  lumy.logger.error('Erreur lors de l\'exécution', error);
}
```

## API Météo

### `lumy.weather.getCurrent()`

Récupère les données météo actuelles.

**Retourne** : `Promise<WeatherData>`

```javascript
const weather = await lumy.weather.getCurrent();
console.log(weather.temperature, weather.humidity);
```

### `lumy.weather.getForecast(days)`

Récupère les prévisions météo.

**Paramètres** :
- `days` (number) : Nombre de jours (par défaut: 5)

**Retourne** : `Promise<WeatherForecast[]>`

```javascript
const forecast = await lumy.weather.getForecast(7);
```

## API Système

### `lumy.system.getVersion()`

Récupère la version de Lumy Home.

**Retourne** : `Promise<string>`

```javascript
const version = await lumy.system.getVersion();
```

### `lumy.system.getConfig()`

Récupère la configuration système.

**Retourne** : `Promise<SystemConfig>`

```javascript
const config = await lumy.system.getConfig();
```

## Types TypeScript

Pour les développeurs TypeScript, voici les types disponibles :

```typescript
interface Device {
  id: string;
  name: string;
  type: string;
  roomId?: string;
  state: DeviceState;
  mqttName: string;
}

interface DeviceState {
  on?: boolean;
  brightness?: number;
  color?: { r: number; g: number; b: number };
  temperature?: number;
  humidity?: number;
  position?: number;  // Pour les volets (0-100)
  [key: string]: any;
}

interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  action: Action;
}

interface Room {
  id: string;
  name: string;
  icon?: string;
  devices: Device[];
}

interface WeatherData {
  temperature: number;
  humidity: number;
  pressure: number;
  description: string;
  icon: string;
}
```

## Gestion des erreurs

Toutes les méthodes API peuvent lever des erreurs. Toujours utiliser try/catch :

```javascript
try {
  const device = await lumy.devices.get('invalid-id');
} catch (error) {
  lumy.logger.error('Erreur lors de la récupération de l\'appareil', error);
  // Gérer l'erreur gracieusement
}
```

## Limitations

- Les plugins s'exécutent dans un sandbox sécurisé
- Les ressources (CPU, mémoire) sont limitées
- Les timeouts sont appliqués aux opérations longues
- L'accès au système de fichiers est restreint

