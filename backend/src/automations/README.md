# Module Automatisations

Ce module gère les automatisations ultra-simples basées sur des événements Zigbee.

## Fonctionnalités

### Types de déclencheurs supportés

- **MOTION** : Détection de mouvement (occupancy, presence, motion)
- **CONTACT** : Ouverture/fermeture de porte ou fenêtre
- **TEMPERATURE** : Changement de température (avec conditions optionnelles)
- **BUTTON** : Appui sur un bouton

### Types d'actions supportées

- **TURN_ON** : Allumer un appareil
- **TURN_OFF** : Éteindre un appareil
- **SET_BRIGHTNESS** : Changer l'intensité lumineuse
- **SET_COLOR** : Changer la couleur
- **NOTIFY** : Envoyer une notification

## Endpoints API

- `GET /automations` : Liste toutes les automatisations
- `GET /automations/:id` : Récupère une automatisation
- `POST /automations` : Crée une automatisation
- `PUT /automations/:id` : Met à jour une automatisation
- `PATCH /automations/:id/toggle` : Active/désactive une automatisation
- `DELETE /automations/:id` : Supprime une automatisation
- `GET /automations/:id/logs` : Récupère les logs d'exécution

## Exemple d'utilisation

### Créer une automatisation "Allumer la lumière quand mouvement détecté"

```json
{
  "name": "Lumière automatique entrée",
  "description": "Allume la lumière de l'entrée quand mouvement détecté",
  "trigger": {
    "type": "motion",
    "deviceId": "0x00124b0012345678",
    "deviceName": "Capteur mouvement entrée"
  },
  "actions": [
    {
      "type": "turn_on",
      "deviceId": "0x00124b0012345679",
      "deviceName": "Lumière entrée"
    }
  ]
}
```

### Créer une automatisation avec condition de température

```json
{
  "name": "Alerte température élevée",
  "description": "Notifie si température > 25°C",
  "trigger": {
    "type": "temperature",
    "deviceId": "0x00124b0012345678",
    "condition": {
      "operator": ">",
      "value": 25
    }
  },
  "actions": [
    {
      "type": "notify",
      "params": {
        "message": "Température élevée détectée !"
      }
    }
  ]
}
```

## Logs d'exécution

Chaque exécution d'automatisation est enregistrée dans la table `automation_execution_logs` avec :
- Timestamp
- Succès/échec
- Données du déclencheur
- Résultats de chaque action

