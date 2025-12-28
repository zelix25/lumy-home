# GitHub Actions Workflows

## Docker Build and Push

Ce workflow construit et publie les images Docker du frontend et du backend sur Docker Hub.

### Déclencheurs

- **Push de tags** : Se déclenche automatiquement lors d'un push de tag Git
  - Tags stables : `v1.0.0`, `v2.3.4`, etc.
  - Tags beta : `v1.0.0-beta`, `v2.3.4-beta.1`, etc.

- **Déclenchement manuel** : Peut être déclenché manuellement depuis l'interface GitHub Actions avec un tag de version personnalisé

### Configuration requise

Vous devez configurer les secrets suivants dans les paramètres du dépôt GitHub :

- `DOCKER_REGISTRY_USERNAME` : Votre nom d'utilisateur sur le registry privé `hub.nod-app.com`
- `DOCKER_REGISTRY_PASSWORD` : Votre mot de passe ou token d'accès au registry privé

### Configuration des secrets GitHub

1. Allez dans **Settings** > **Secrets and variables** > **Actions**
2. Cliquez sur **New repository secret**
3. Créez les deux secrets :
   - `DOCKER_REGISTRY_USERNAME` : Votre nom d'utilisateur
   - `DOCKER_REGISTRY_PASSWORD` : Votre mot de passe ou token

Pour plus de détails, consultez le fichier [REGISTRY_SETUP.md](./REGISTRY_SETUP.md).

### Tags d'images générés

Pour chaque build, les images suivantes sont créées :

#### Version stable (ex: `v1.0.0`)
- `hub.nod-app.com/username/nodapp-backend:stable`
- `hub.nod-app.com/username/nodapp-backend:stable-1.0.0`
- `hub.nod-app.com/username/nodapp-backend:v1.0.0`
- `hub.nod-app.com/username/nodapp-frontend:stable`
- `hub.nod-app.com/username/nodapp-frontend:stable-1.0.0`
- `hub.nod-app.com/username/nodapp-frontend:v1.0.0`

#### Version beta (ex: `v1.0.0-beta`)
- `hub.nod-app.com/username/nodapp-backend:beta`
- `hub.nod-app.com/username/nodapp-backend:beta-1.0.0`
- `hub.nod-app.com/username/nodapp-backend:v1.0.0-beta`
- `hub.nod-app.com/username/nodapp-frontend:beta`
- `hub.nod-app.com/username/nodapp-frontend:beta-1.0.0`
- `hub.nod-app.com/username/nodapp-frontend:v1.0.0-beta`

### Utilisation

#### Créer un tag et publier

```bash
# Tag stable
git tag v1.0.0
git push origin v1.0.0

# Tag beta
git tag v1.0.0-beta
git push origin v1.0.0-beta
```

#### Déclencher manuellement

1. Allez dans **Actions** > **Build and Push Docker Images**
2. Cliquez sur **Run workflow**
3. Entrez le tag de version (ex: `v1.0.0` ou `v1.0.0-beta`)
4. Cliquez sur **Run workflow**

### Cache Docker

Le workflow utilise le cache Docker pour accélérer les builds :
- Cache stocké dans `hub.nod-app.com/username/nodapp-backend:buildcache`
- Cache stocké dans `hub.nod-app.com/username/nodapp-frontend:buildcache`

### Structure des jobs

1. **determine-version** : Détermine la version et le type (stable/beta) à partir du tag
2. **build-and-push-backend** : Construit et publie l'image Docker du backend
3. **build-and-push-frontend** : Construit et publie l'image Docker du frontend
4. **summary** : Génère un résumé de la build dans les Actions GitHub

