# Installation du Plugin Météo

Ce guide explique comment installer et configurer le plugin météo dans Lumy Home.

## Prérequis

1. Une instance de Lumy Home fonctionnelle
2. Une clé API OpenWeatherMap (gratuite sur [openweathermap.org](https://openweathermap.org/api))

## Installation

### Méthode 1 : Depuis le Lumy Store (recommandé)

1. Ouvrez Lumy Home
2. Allez dans **Paramètres** > **Plugins**
3. Cliquez sur **Lumy Store**
4. Recherchez "Météo" ou "Weather"
5. Cliquez sur **Installer**

### Méthode 2 : Installation manuelle

1. Téléchargez le plugin depuis le dépôt
2. Créez un fichier ZIP contenant :
   - `manifest.json`
   - Dossier `dist/`
3. Dans Lumy Home, allez dans **Paramètres** > **Plugins**
4. Cliquez sur **Installer un plugin**
5. Sélectionnez le fichier ZIP

## Configuration

Après l'installation, configurez le plugin :

1. Allez dans **Paramètres** > **Plugins**
2. Trouvez le plugin "Météo"
3. Cliquez sur **Configurer**

### Paramètres requis

- **Clé API OpenWeatherMap** : Votre clé API (obtenue sur openweathermap.org)
- **Ville** : Nom de la ville (ex: "Paris")

### Paramètres optionnels

- **Pays** : Code pays ISO (ex: "FR", "US") - Par défaut: "FR"
- **Unités** : Système d'unités (metric, imperial, kelvin) - Par défaut: "metric"
- **Intervalle de mise à jour** : Fréquence de mise à jour en minutes (5-1440) - Par défaut: 30

## Utilisation

### Widget sur le Dashboard

1. Allez sur votre **Dashboard**
2. Cliquez sur **Ajouter un widget**
3. Sélectionnez **Widget Météo**
4. Le widget affichera la météo de la ville configurée

### Page Météo complète

1. Allez dans le menu principal
2. Cliquez sur **Météo**
3. Vous verrez la météo actuelle et les prévisions

## Dépannage

### Le widget n'affiche pas de données

- Vérifiez que la clé API est correctement configurée
- Vérifiez que le nom de la ville est correct
- Consultez les logs dans **Paramètres** > **Logs**

### Erreur "Configuration incomplète"

- Assurez-vous que la clé API et la ville sont renseignées
- Vérifiez que le plugin est activé

### Les données ne se mettent pas à jour

- Vérifiez l'intervalle de mise à jour dans la configuration
- Vérifiez votre connexion Internet
- Consultez les logs pour plus de détails

## Support

Pour plus d'aide :
- Consultez la [documentation](https://docs.lumy-home.com/plugins/weather)
- Ouvrez une issue sur [GitHub](https://github.com/lumy-home/plugins/issues)

