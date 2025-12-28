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

- `DOCKER_HUB_USERNAME` : Votre nom d'utilisateur Docker Hub
- `DOCKER_HUB_TOKEN` : Votre token d'accès Docker Hub (pas votre mot de passe)

### Configuration des secrets GitHub

1. Allez dans **Settings** > **Secrets and variables** > **Actions**
2. Cliquez sur **New repository secret**
3. Créez les deux secrets :
   - `DOCKER_HUB_USERNAME` : Votre nom d'utilisateur Docker Hub
   - `DOCKER_HUB_TOKEN` : Votre token d'accès Docker Hub

#### Créer un token Docker Hub

Pour créer un token d'accès Docker Hub :

1. Connectez-vous sur [Docker Hub](https://hub.docker.com/)
2. Allez dans **Account Settings** > **Security**
3. Cliquez sur **New Access Token**
4. Donnez un nom à votre token (ex: "GitHub Actions")
5. Copiez le token généré et ajoutez-le comme secret GitHub `DOCKER_HUB_TOKEN`

⚠️ **Important** : Utilisez un token d'accès, pas votre mot de passe Docker Hub.

### Tags d'images générés

Pour chaque build, les images suivantes sont créées :

#### Version stable (ex: `v1.0.0`)
- `username/lumy-home-backend:stable`
- `username/lumy-home-backend:stable-1.0.0`
- `username/lumy-home-backend:v1.0.0`
- `username/lumy-home-backend:1.0.0`
- `username/lumy-home-backend:1.0`
- `username/lumy-home-backend:1`
- `username/lumy-home-frontend:stable`
- `username/lumy-home-frontend:stable-1.0.0`
- `username/lumy-home-frontend:v1.0.0`
- `username/lumy-home-frontend:1.0.0`
- `username/lumy-home-frontend:1.0`
- `username/lumy-home-frontend:1`

#### Version beta (ex: `v1.0.0-beta`)
- `username/lumy-home-backend:beta`
- `username/lumy-home-backend:beta-1.0.0`
- `username/lumy-home-backend:v1.0.0-beta`
- `username/lumy-home-frontend:beta`
- `username/lumy-home-frontend:beta-1.0.0`
- `username/lumy-home-frontend:v1.0.0-beta`

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
- Cache stocké dans `username/lumy-home-backend:buildcache`
- Cache stocké dans `username/lumy-home-frontend:buildcache`

### Structure des jobs

1. **determine-version** : Détermine la version et le type (stable/beta) à partir du tag
2. **build-and-push-backend** : Construit et publie l'image Docker du backend
3. **build-and-push-frontend** : Construit et publie l'image Docker du frontend
4. **summary** : Génère un résumé de la build dans les Actions GitHub avec des liens vers Docker Hub

### Liens Docker Hub

Après chaque build réussi, le workflow génère des liens directs vers les images sur Docker Hub :
- [Backend Image](https://hub.docker.com/r/username/lumy-home-backend)
- [Frontend Image](https://hub.docker.com/r/username/lumy-home-frontend)

Remplacez `username` par votre nom d'utilisateur Docker Hub.

