# Système de Hooks/Événements pour les Plugins

## Vue d'ensemble

Le système de hooks permet aux plugins de réagir aux événements du système Lumy Home. Les plugins peuvent enregistrer des handlers pour différents types d'événements et exécuter du code personnalisé lorsque ces événements se produisent.

## Types d'événements disponibles

### Événements d'appareils
- `device:update` - Un appareil a été mis à jour
- `device:state_change` - L'état d'un appareil a changé
- `device:added` - Un nouvel appareil a été ajouté
- `device:removed` - Un appareil a été supprimé
- `device:online` - Un appareil est passé en ligne
- `device:offline` - Un appareil est passé hors ligne

### Événements d'automations
- `automation:triggered` - Une automation a été déclenchée
- `automation:executed` - Une automation a été exécutée
- `automation:created` - Une automation a été créée
- `automation:updated` - Une automation a été mise à jour
- `automation:deleted` - Une automation a été supprimée

### Événements de pièces
- `room:created` - Une pièce a été créée
- `room:updated` - Une pièce a été mise à jour
- `room:deleted` - Une pièce a été supprimée

### Événements système
- `system:startup` - Démarrage du système
- `system:shutdown` - Arrêt du système
- `plugin:enabled` - Un plugin a été activé
- `plugin:disabled` - Un plugin a été désactivé
- `plugin:installed` - Un plugin a été installé
- `plugin:uninstalled` - Un plugin a été désinstallé

### Événements météo
- `weather:update` - Les données météo ont été mises à jour

### Événements personnalisés
- `custom` - Événement personnalisé (pour les plugins qui veulent déclencher leurs propres événements)

## Configuration dans le manifest.json

Les hooks sont déclarés dans le `manifest.json` du plugin :

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "hooks": {
    "device:update": "hooks/device-update.js",
    "automation:triggered": "hooks/automation-trigger.js"
  },
  "metadata": {
    "hookPriorities": {
      "device:update": 50,
      "automation:triggered": 100
    }
  }
}
```

## Structure d'un handler

Un handler est un fichier JavaScript qui exporte une fonction asynchrone :

```javascript
// hooks/device-update.js
module.exports = async function(event) {
  const { type, timestamp, data, source } = event;
  
  // data contient les informations de l'appareil mis à jour
  console.log(`Appareil ${data.deviceId} mis à jour`);
  
  // Votre logique personnalisée ici
};
```

## Priorités des hooks

Les hooks peuvent avoir des priorités pour contrôler l'ordre d'exécution :
- Priorité plus basse = exécuté en premier
- Par défaut : 100

## Déclenchement d'événements depuis le code

Pour déclencher un événement depuis n'importe quel service :

```typescript
import { PluginHooksService } from '../plugins/hooks/plugin-hooks.service';
import { PluginHookType } from '../plugins/hooks/plugin-hooks.enum';

// Dans votre service
constructor(private hooksService: PluginHooksService) {}

async someMethod() {
  // Déclencher un événement
  await this.hooksService.triggerHook(
    PluginHookType.DEVICE_UPDATE,
    {
      deviceId: '0x1234',
      deviceName: 'Lumière Salon',
      state: { on: true, brightness: 100 }
    },
    'devices' // source
  );
}
```

## API REST

- `GET /plugins/:id/hooks` - Récupère les hooks d'un plugin
- `GET /plugins/hooks/all` - Récupère tous les hooks enregistrés
- `POST /plugins/hooks/trigger` - Déclenche un événement manuellement (pour les tests)

## Sécurité

⚠️ **Important** : L'exécution réelle des handlers nécessite un système de sandboxing sécurisé. Actuellement, les hooks sont enregistrés mais l'exécution est simulée. L'implémentation complète nécessitera :
- Isolation du code des plugins
- Limites de ressources (CPU, mémoire, temps d'exécution)
- Validation des entrées/sorties
- Gestion des erreurs et isolation des crashes

