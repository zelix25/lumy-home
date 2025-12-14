# FAQ - Développement de plugins

## Questions générales

### Comment créer mon premier plugin ?

1. Créez un nouveau dossier pour votre plugin
2. Créez un fichier `manifest.json` avec les métadonnées de base
3. Ajoutez vos fichiers (hooks, point d'entrée, etc.)
4. Testez localement
5. Packagez en `.tar.gz` et installez

Voir [README.md](./README.md) pour plus de détails.

### Quelle version de Lumy Home dois-je cibler ?

Spécifiez toujours `lumyVersion` dans votre manifest. Utilisez le format semver :

```json
{
  "lumyVersion": "^1.0.0"  // Compatible avec 1.0.0 et versions supérieures (mais < 2.0.0)
}
```

### Comment tester mon plugin localement ?

1. Créez une archive `.tar.gz` de votre plugin
2. Dans Lumy Home, allez dans Plugins > Installer
3. Utilisez le chemin local : `file:///chemin/vers/votre-plugin.tar.gz`

## Permissions

### Quelles permissions dois-je demander ?

Demandez uniquement les permissions nécessaires. Par exemple :
- Pour lire les appareils : `read:devices`
- Pour contrôler : `control:devices`
- Pour envoyer des notifications : `notifications:send`

### Puis-je demander toutes les permissions "au cas où" ?

Non. Les permissions sont vérifiées et les utilisateurs voient les permissions demandées. Demandez uniquement ce dont vous avez besoin.

## Hooks

### Comment savoir quel événement utiliser ?

Consultez la [liste des événements disponibles](./README.md#types-dévénements-disponibles) dans la documentation.

### Puis-je créer mes propres événements ?

Oui, utilisez le type `custom` :

```json
{
  "hooks": {
    "custom:my-event": "hooks/my-event.js"
  }
}
```

Puis déclenchez-le depuis votre code :

```javascript
await lumy.events.trigger('custom:my-event', { data: 'value' });
```

### Quelle priorité dois-je utiliser pour mes hooks ?

- Priorité basse (10-50) : Hooks qui doivent s'exécuter en premier
- Priorité moyenne (50-100) : Hooks normaux
- Priorité haute (100+) : Hooks qui doivent s'exécuter en dernier

## Configuration

### Comment valider la configuration de l'utilisateur ?

Utilisez JSON Schema dans `configSchema`. Le système valide automatiquement :

```json
{
  "configSchema": {
    "type": "object",
    "properties": {
      "apiKey": {
        "type": "string",
        "minLength": 10
      }
    },
    "required": ["apiKey"]
  }
}
```

### Puis-je avoir des valeurs par défaut ?

Oui, utilisez `default` dans votre schéma :

```json
{
  "properties": {
    "refreshInterval": {
      "type": "number",
      "default": 60
    }
  }
}
```

## Dépendances

### Comment déclarer une dépendance vers un autre plugin ?

Dans votre `manifest.json` :

```json
{
  "dependencies": {
    "weather-plugin": "^1.0.0"
  }
}
```

Le plugin sera automatiquement installé lors de l'installation de votre plugin.

### Que se passe-t-il si une dépendance n'est pas disponible ?

L'installation échouera avec un message d'erreur indiquant la dépendance manquante.

## Erreurs et débogage

### Comment déboguer mon plugin ?

Utilisez les logs :

```javascript
lumy.logger.debug('Information de debug');
lumy.logger.info('Information générale');
lumy.logger.warn('Avertissement');
lumy.logger.error('Erreur', error);
```

Les logs sont disponibles dans l'interface Lumy Home sous Plugins > [Votre Plugin] > Logs.

### Mon plugin plante, que faire ?

1. Vérifiez les logs pour identifier l'erreur
2. Assurez-vous de gérer toutes les erreurs avec try/catch
3. Vérifiez que vous avez les permissions nécessaires
4. Testez avec des données minimales

## Performance

### Mon plugin est lent, comment l'optimiser ?

- Évitez les opérations bloquantes
- Utilisez des timeouts pour les opérations longues
- Limitez la fréquence des appels API
- Cachez les données quand c'est possible

### Y a-t-il des limites de ressources ?

Oui, les plugins s'exécutent dans un sandbox avec :
- Limite de mémoire
- Limite de CPU
- Timeouts sur les opérations longues

## Publication

### Comment publier mon plugin dans le Lumy Store ?

1. Créez un compte développeur
2. Préparez votre plugin (README, tests, etc.)
3. Soumettez pour review
4. Une fois approuvé, votre plugin sera disponible

### Puis-je vendre mon plugin ?

Oui, le système supporte les plugins premium avec paiement. Contactez le support pour plus d'informations.

## Support

### Où obtenir de l'aide ?

- Documentation : [README.md](./README.md) et [API.md](./API.md)
- Exemples : [examples/](./examples/)
- Forum : https://community.lumy.home
- Support : dev@lumy.home

