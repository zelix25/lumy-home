# Endpoints accessibles avec le token API

## Vue d'ensemble

Ce document liste les endpoints qui devraient être accessibles depuis Lumy Home en utilisant le token API (`lumy_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`).

✅ **Implémentation** : Ces endpoints utilisent maintenant `JwtOrApiTokenGuard` qui accepte soit un JWT soit un token API. Le guard essaie d'abord le JWT, puis le token API si le JWT n'est pas présent ou invalide.

## Format d'authentification

Le token API peut être envoyé de deux manières :

1. **Header Authorization (recommandé)** :
   ```
   Authorization: Bearer lumy_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

2. **Header X-API-Token** :
   ```
   X-API-Token: lumy_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

## Endpoints publics (sans authentification)

Ces endpoints sont déjà accessibles sans authentification :

### Plugins

- `GET /api/plugins/public` - Rechercher des plugins publics
  - Query params : `category`, `tags`, `search`, `licenseType`, `minRating`, `limit`, `offset`
  
- `GET /api/plugins/public/:id` - Obtenir les détails d'un plugin public

- `GET /api/plugins/:id/download` - Télécharger un plugin publié (protégé, nécessite JWT ou token API)

### Avis

- `GET /api/reviews/plugin/:pluginId` - Obtenir les avis d'un plugin

## Endpoints accessibles avec le token API

Ces endpoints acceptent maintenant soit un JWT soit un token API :

### Plugins

#### 1. Télécharger un plugin
```
GET /api/plugins/:id/download
Authorization: Bearer lumy_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Description** : Permet à Lumy Home de télécharger un plugin que l'utilisateur a acheté ou auquel il est abonné.

**Réponse** : Fichier ZIP du plugin

**Note** : L'endpoint est maintenant protégé. Pour les plugins payants, la vérification de l'achat/abonnement sera implémentée prochainement.

---

#### 2. Obtenir les détails d'un plugin (avec informations utilisateur)
```
GET /api/plugins/:id
Authorization: Bearer lumy_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Description** : Obtenir les détails d'un plugin, y compris les informations spécifiques à l'utilisateur (statut d'achat, abonnement, etc.).

**Réponse** :
```json
{
  "id": "uuid",
  "name": "plugin-name",
  "displayName": "Plugin Name",
  "version": "1.0.0",
  "description": "Description",
  "longDescription": "Long description",
  "author": "Author Name",
  "icon": "https://...",
  "repository": "https://...",
  "lumyVersion": "1.0.0",
  "category": "automation",
  "tags": ["tag1", "tag2"],
  "licenseType": "free",
  "price": 0,
  "currency": "EUR",
  "downloadUrl": "https://...",
  "screenshotUrl": "https://...",
  "screenshots": ["https://..."],
  "documentationUrl": "https://...",
  "status": "published",
  "downloads": 100,
  "rating": 4.5,
  "reviewsCount": 20,
  "userHasPurchased": true,
  "userIsSubscribed": false,
  "userCanDownload": true
}
```

---

### Avis

#### 3. Créer un avis
```
POST /api/reviews/plugin/:pluginId
Authorization: Bearer lumy_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "rating": 5,
  "comment": "Excellent plugin !",
  "userName": "Nom de l'utilisateur"
}
```

**Description** : Permet à Lumy Home de créer un avis au nom de l'utilisateur pour un plugin qu'il a acheté.

**Réponse** :
```json
{
  "id": "uuid",
  "pluginId": "uuid",
  "userId": "uuid",
  "userName": "Nom de l'utilisateur",
  "rating": 5,
  "comment": "Excellent plugin !",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Note** : Le `userId` est automatiquement extrait du token API ou du JWT, pas besoin de le fournir dans le body. Le champ `userId` dans le body est ignoré.

---

### Factures

#### 4. Obtenir la liste des factures
```
GET /api/invoices/me
Authorization: Bearer lumy_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Query params** :
- `status` : `pending` | `paid` | `failed` | `refunded`
- `type` : `purchase` | `subscription`
- `limit` : nombre (défaut: 20)
- `offset` : nombre (défaut: 0)

**Description** : Permet à Lumy Home de récupérer la liste des factures de l'utilisateur.

**Réponse** :
```json
[
  {
    "id": "uuid",
    "invoiceNumber": "INV-2024-001",
    "userId": "uuid",
    "pluginId": "uuid",
    "pluginName": "Plugin Name",
    "amount": 9.99,
    "tax": 1.99,
    "total": 11.98,
    "currency": "EUR",
    "status": "paid",
    "type": "purchase",
    "paidAt": "2024-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

#### 5. Obtenir une facture spécifique
```
GET /api/invoices/:id
Authorization: Bearer lumy_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Description** : Obtenir les détails d'une facture spécifique.

**Réponse** :
```json
{
  "id": "uuid",
  "invoiceNumber": "INV-2024-001",
  "userId": "uuid",
  "pluginId": "uuid",
  "pluginName": "Plugin Name",
  "amount": 9.99,
  "tax": 1.99,
  "total": 11.98,
  "currency": "EUR",
  "status": "paid",
  "type": "purchase",
  "paidAt": "2024-01-01T00:00:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "metadata": {}
}
```

---

#### 6. Télécharger une facture (PDF)
```
GET /api/invoices/:id/download
Authorization: Bearer lumy_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Description** : Télécharger le PDF d'une facture.

**Réponse** : Fichier PDF

---

### Profil utilisateur

#### 7. Obtenir le profil utilisateur
```
GET /api/users/me
Authorization: Bearer lumy_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Description** : Obtenir les informations du profil utilisateur.

**Réponse** :
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "isVerified": true,
  "status": "active",
  "twoFactorEnabled": false,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

## Endpoints non accessibles avec le token API

Ces endpoints nécessitent un JWT et ne sont pas accessibles avec le token API :

### Gestion du compte utilisateur
- `PUT /api/users/me/password` - Modifier le mot de passe
- `PUT /api/users/me/email` - Modifier l'email
- `GET /api/users/me/api-token` - Obtenir le token API
- `POST /api/users/me/api-token/regenerate` - Régénérer le token API
- `GET /api/users/me/2fa/generate` - Générer le secret 2FA
- `POST /api/users/me/2fa/enable` - Activer la 2FA
- `DELETE /api/users/me/2fa/disable` - Désactiver la 2FA
- `POST /api/users/me/2fa/verify` - Vérifier un token 2FA

**Raison** : Ces endpoints nécessitent une authentification interactive (JWT) pour des raisons de sécurité.

---

## Implémentation

L'implémentation utilise un guard composite `JwtOrApiTokenGuard` qui :

1. **Vérifie d'abord le JWT** : Si un JWT valide est présent, l'authentification se fait via JWT
2. **Essaie ensuite le token API** : Si le JWT n'est pas présent ou invalide, le guard essaie le token API
3. **Détecte automatiquement le type de token** : Le guard détecte si le token commence par `lumy_` (token API) ou non (JWT)

Les endpoints utilisent maintenant :
```typescript
@UseGuards(JwtOrApiTokenGuard)
```

---

## Exemple d'utilisation depuis Lumy Home

```typescript
// Configuration
const STORE_API_URL = 'https://store.lumy.home/api';
const USER_API_TOKEN = 'lumy_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

// Fonction helper pour les requêtes
async function storeRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${STORE_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${USER_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Store API error: ${response.statusText}`);
  }
  
  return response.json();
}

// Exemples d'utilisation

// 1. Rechercher des plugins
const plugins = await storeRequest('/plugins/public?category=automation&limit=10');

// 2. Obtenir les détails d'un plugin
const plugin = await storeRequest('/plugins/plugin-id');

// 3. Télécharger un plugin
const pluginZip = await fetch(`${STORE_API_URL}/plugins/plugin-id/download`, {
  headers: {
    'Authorization': `Bearer ${USER_API_TOKEN}`,
  },
});

// 4. Créer un avis
await storeRequest('/reviews/plugin/plugin-id', {
  method: 'POST',
  body: JSON.stringify({
    rating: 5,
    comment: 'Excellent plugin !',
    userName: 'John Doe',
  }),
});

// 5. Obtenir les factures
const invoices = await storeRequest('/invoices/me?status=paid&limit=20');

// 6. Télécharger une facture
const invoicePdf = await fetch(`${STORE_API_URL}/invoices/invoice-id/download`, {
  headers: {
    'Authorization': `Bearer ${USER_API_TOKEN}`,
  },
});

// 7. Obtenir le profil utilisateur
const profile = await storeRequest('/users/me');
```

---

## Notes de sécurité

1. **Validation** : Le token API est validé à chaque requête par `ApiTokenGuard`
2. **Comptes suspendus** : Les comptes suspendus ne peuvent pas utiliser leur token API
3. **Régénération** : Si un token est régénéré, l'ancien devient immédiatement invalide
4. **HTTPS** : Toutes les communications doivent se faire en HTTPS en production
5. **Rate limiting** : Les endpoints sont protégés par rate limiting (100 req/min par défaut)

