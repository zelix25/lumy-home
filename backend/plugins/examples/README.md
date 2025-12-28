# Exemples de plugins

Ce dossier contient des exemples de plugins pour Lumy Home.

## Plugins disponibles

### simple-hook-plugin

Un exemple simple de plugin qui utilise uniquement un hook pour réagir aux événements d'appareils.

**Fonctionnalités** :
- Hook `device:update` pour surveiller les mises à jour d'appareils
- Envoi de notifications si la température est élevée
- Logging des événements

**Structure** :
```
simple-hook-plugin/
├── manifest.json
└── hooks/
    └── device-update.js
```

### advanced-plugin

Un exemple avancé de plugin avec point d'entrée, hooks multiples et configuration.

**Fonctionnalités** :
- Point d'entrée principal (`index.js`)
- Service périodique pour vérifier les appareils
- Hooks multiples (device:update, automation:triggered, system:startup)
- Configuration avec schéma JSON Schema
- Utilisation du stockage pour persister des données

**Structure** :
```
advanced-plugin/
├── manifest.json
├── index.js
└── hooks/
    ├── device-update.js
    ├── automation-trigger.js
    └── system-startup.js
```

## Utilisation

Pour tester un exemple :

1. Naviguez vers le dossier de l'exemple
2. Créez une archive `.tar.gz` :
   ```bash
   tar -czf simple-hook-plugin.tar.gz simple-hook-plugin/
   ```
3. Installez dans Lumy Home via l'interface ou l'API

## Créer votre propre plugin

1. Copiez un exemple comme point de départ
2. Modifiez le `manifest.json` avec vos informations
3. Implémentez votre logique
4. Testez localement
5. Packagez et installez

Voir [../README.md](../README.md) pour plus de détails.

