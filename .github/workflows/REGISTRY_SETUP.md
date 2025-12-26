# Configuration du Registry Docker Privé

Ce document explique comment configurer la connexion au registry Docker privé `hub.nod-app.com` pour la pipeline GitHub Actions.

## Prérequis

- Un compte sur le registry Docker privé `hub.nod-app.com`
- Les permissions nécessaires pour push/pull des images Docker
- Accès aux paramètres du dépôt GitHub pour configurer les secrets

## Configuration GitHub Secrets

### Étape 1 : Accéder aux Secrets GitHub

1. Allez sur votre dépôt GitHub
2. Cliquez sur **Settings** (Paramètres)
3. Dans le menu de gauche, cliquez sur **Secrets and variables** > **Actions**
4. Cliquez sur **New repository secret**

### Étape 2 : Créer les secrets requis

Créez les deux secrets suivants :

#### Secret 1 : `DOCKER_REGISTRY_USERNAME`
- **Name** : `DOCKER_REGISTRY_USERNAME`
- **Value** : Votre nom d'utilisateur sur le registry `hub.nod-app.com`
- Cliquez sur **Add secret**

#### Secret 2 : `DOCKER_REGISTRY_PASSWORD`
- **Name** : `DOCKER_REGISTRY_PASSWORD`
- **Value** : Votre mot de passe ou token d'accès au registry
- Cliquez sur **Add secret**

## Connexion au Registry depuis la ligne de commande

### Méthode 1 : Connexion avec docker login

```bash
# Se connecter au registry
docker login hub.nod-app.com

# Entrez votre nom d'utilisateur et mot de passe quand demandé
```

### Méthode 2 : Connexion avec token (recommandé)

Si vous utilisez un token d'accès :

```bash
# Se connecter avec un token
echo "VOTRE_TOKEN" | docker login hub.nod-app.com -u "VOTRE_USERNAME" --password-stdin
```

### Vérifier la connexion

```bash
# Tester la connexion en pullant une image (si elle existe)
docker pull hub.nod-app.com/VOTRE_USERNAME/nodapp-backend:stable

# Ou en listant les images disponibles (selon les permissions du registry)
```

## Utilisation des images dans docker-compose

Une fois les images publiées, vous pouvez les utiliser dans votre `docker-compose.yml` :

```yaml
version: '3.8'

services:
  backend:
    image: hub.nod-app.com/VOTRE_USERNAME/nodapp-backend:stable
    # ... autres configurations

  frontend:
    image: hub.nod-app.com/VOTRE_USERNAME/nodapp-frontend:stable
    # ... autres configurations
```

### Authentification dans docker-compose

Si vous utilisez docker-compose sur un serveur, vous devez d'abord vous authentifier :

```bash
# Sur le serveur de production
docker login hub.nod-app.com
```

Les credentials seront stockés dans `~/.docker/config.json`.

## Configuration pour CI/CD local

Si vous voulez tester la pipeline localement ou utiliser les images dans un autre environnement CI/CD :

### Variables d'environnement

```bash
export DOCKER_REGISTRY_USERNAME="votre_username"
export DOCKER_REGISTRY_PASSWORD="votre_password"
export DOCKER_REGISTRY="hub.nod-app.com"
```

### Authentification programmatique

```bash
# Script d'authentification
#!/bin/bash
echo "$DOCKER_REGISTRY_PASSWORD" | docker login "$DOCKER_REGISTRY" \
  -u "$DOCKER_REGISTRY_USERNAME" \
  --password-stdin
```

## Dépannage

### Erreur : "unauthorized: authentication required"

**Cause** : Les credentials sont incorrects ou le secret GitHub n'est pas configuré.

**Solution** :
1. Vérifiez que les secrets `DOCKER_REGISTRY_USERNAME` et `DOCKER_REGISTRY_PASSWORD` sont bien configurés dans GitHub
2. Testez la connexion en local avec `docker login hub.nod-app.com`
3. Vérifiez que votre compte a les permissions nécessaires

### Erreur : "denied: requested access to the resource is denied"

**Cause** : Votre compte n'a pas les permissions pour push/pull sur le namespace.

**Solution** :
1. Contactez l'administrateur du registry pour obtenir les permissions
2. Vérifiez que vous utilisez le bon namespace/username dans les noms d'images

### Erreur : "certificate signed by unknown authority"

**Cause** : Le registry utilise un certificat SSL auto-signé ou non reconnu.

**Solution** :
1. Pour le développement local, vous pouvez temporairement désactiver la vérification SSL (non recommandé en production) :
   ```bash
   # Ajouter dans /etc/docker/daemon.json
   {
     "insecure-registries": ["hub.nod-app.com"]
   }
   ```
2. Ou ajouter le certificat du registry aux certificats de confiance de votre système

## Sécurité

### Bonnes pratiques

1. **Utilisez des tokens d'accès** plutôt que des mots de passe
2. **Limitez les permissions** des tokens aux actions nécessaires (read/write)
3. **Rotez régulièrement** les tokens d'accès
4. **Ne commitez jamais** les credentials dans le code
5. **Utilisez des secrets GitHub** pour stocker les credentials

### Création d'un token d'accès

Si votre registry supporte les tokens d'accès (comme Docker Hub) :

1. Connectez-vous à l'interface web du registry
2. Allez dans les paramètres de votre compte
3. Créez un nouveau token d'accès avec les permissions **Read & Write**
4. Utilisez ce token comme `DOCKER_REGISTRY_PASSWORD`

## Structure des images publiées

Les images sont publiées avec la structure suivante :

```
hub.nod-app.com/VOTRE_USERNAME/nodapp-backend:TAG
hub.nod-app.com/VOTRE_USERNAME/nodapp-frontend:TAG
```

Où `TAG` peut être :
- `stable` ou `beta` (tag de type)
- `stable-1.0.0` ou `beta-1.0.0` (type + version)
- `v1.0.0` (tag complet du Git)

## Support

Pour toute question ou problème, contactez l'équipe DevOps ou l'administrateur du registry.

