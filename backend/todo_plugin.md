# TODO - Système de Plugins Lumy Home

Liste des 30 points de développement pour le système de plugins complet de Lumy Home.

## 0. Intégration avec le Lumy Store

**IMPORTANT** : Tous les plugins seront disponibles exclusivement depuis le Lumy Store accessible via `https://store.lumy-home.com`.

0.1. [x] **Ajouter le champ storeApiToken à l'entité User** - Stocker le token API du store pour chaque utilisateur
0.2. [x] **Créer le service StoreAuthService** - Service pour gérer l'authentification avec le Lumy Store
0.3. [x] **Créer le contrôleur StoreAuthController** - Endpoints pour connecter/déconnecter le compte store depuis Lumy Home
0.4. [x] **Implémenter la connexion au store** - Authentification OAuth ou credentials, récupération et stockage de l'apiToken
0.5. [x] **Créer le service StoreApiService** - Service pour faire des requêtes à l'API du store avec l'apiToken
0.6. [x] **Implémenter la gestion du token** - Rafraîchissement automatique, validation, expiration

## 1. Infrastructure de base

1. [x] ✅ **Créer l'entité Plugin** - Modèle de données pour les plugins (id, name, version, status, config, permissions, metadata, etc.)
2. [x] ✅ **Créer le service PluginsService** - Service principal pour la gestion du cycle de vie des plugins (install, enable, disable, uninstall)
3. [x] ✅ **Créer le contrôleur PluginsController** - Endpoints REST pour les opérations CRUD sur les plugins
4. [x] ✅ **Créer le module PluginsModule** - Module NestJS orchestrant tous les services de plugins avec TypeORM

## 2. Cycle de vie des plugins

5. [x] ✅ **Implémenter l'installation de plugins** - Téléchargement depuis le Lumy Store (via API avec apiToken), extraction ZIP, validation du manifest.json, installation des dépendances
6. [x] ✅ **Implémenter l'activation/désactivation** - Chargement/déchargement des plugins en mémoire, gestion de l'état
7. [x] ✅ **Implémenter la désinstallation** - Suppression propre des plugins, nettoyage des données et fichiers
8. [x] ✅ **Implémenter la validation du manifest** - Vérification de la structure JSON, champs requis, format des versions

## 3. Configuration et permissions

9. [x] ✅ **Créer le système de configuration** - Gestion des configurations par plugin avec validation JSON Schema (Ajv)
10. [x] ✅ **Créer le système de permissions** - Analyse statique du code, validation des permissions demandées
11. [x] ✅ **Implémenter la validation des permissions** - Vérification que les permissions demandées sont dans la liste autorisée

## 4. Extensions UI

12. [x] ✅ **Créer le système d'extensions UI** - Enregistrement de pages, composants, widgets et éléments de menu (PluginUIExtension)
13. [x] ✅ **Implémenter le chargement dynamique des routes** - Intégration des routes de plugins dans React Router (usePluginRoutes)
14. [x] ✅ **Implémenter le chargement dynamique des composants** - Chargement des composants React depuis les plugins (PluginComponentLoader)
15. [x] ✅ **Implémenter le chargement dynamique des widgets** - Affichage des widgets dans le dashboard

## 5. Extensions d'automatisation

16. [x] ✅ **Créer le système d'extensions d'automatisation** - Enregistrement de triggers, conditions et actions (PluginAutomationExtension)
17. [x] ✅ **Implémenter le système de hooks** - Déclenchement d'événements pour les plugins (onDeviceUpdate, onSchedule, onTime, etc.)

## 6. Notifications

18. [x] ✅ **Créer le système de notifications** - Permettre aux plugins d'envoyer des notifications aux utilisateurs (PluginNotification)
19. [x] ✅ **Implémenter la livraison en temps réel** - Intégration WebSocket pour les notifications instantanées

## 7. Stockage de données

20. [x] ✅ **Créer le système de stockage isolé** - API de stockage clé-valeur isolée par plugin (PluginStorage)
21. [x] ✅ **Implémenter la gestion du cycle de vie des données** - Expiration automatique, nettoyage, comptage et taille

## 8. Gestion des erreurs

22. [x] ✅ **Créer le système de gestion d'erreurs** - Enregistrement et suivi des erreurs par plugin (PluginError)
23. [x] ✅ **Implémenter le circuit breaker** - Protection contre les plugins défaillants avec seuils configurables
24. [x] ✅ **Implémenter l'isolation des crashes** - Empêcher qu'un plugin crash n'affecte le système principal

## 9. Tests et validation

25. [x] ✅ **Créer le framework de tests** - Tests unitaires, d'intégration, fonctionnels, de sécurité et de performance (PluginTest, PluginTestRun)
26. [x] ✅ **Implémenter la validation avant publication** - Vérification que tous les tests passent avant publication (canPublish)

## 10. Analytics et monitoring

27. [x] ✅ **Créer le système d'analytics** - Suivi des installations, utilisations, erreurs, popularité (PluginAnalytics)
28. [x] ✅ **Implémenter le système de monitoring** - Métriques de performance, logs, statistiques d'exécution (PluginMonitoringService)

## 11. Paiements et licences

29. [x] ✅ **Créer le système de paiement/abonnement** - Intégration Stripe/PayPal pour les plugins premium (PluginPaymentService)
30. [x] ✅ **Implémenter la gestion des licences** - Vérification des licences, gestion des abonnements, génération de clés (PluginLicense)

---

## Fonctionnalités supplémentaires implémentées

- [ ] ✅ **Système de certifications** - Processus de certification des plugins avec review et validation (PluginCertification)
- [ ] ✅ **Système de compatibilité** - Vérification de compatibilité des versions avec Semver (PluginCompatibilityService)
- [ ] ✅ **Système de mises à jour** - Mise à jour automatique des plugins depuis le store (PluginUpdateService)
- [ ] ✅ **Système de backup** - Sauvegarde et restauration des configurations (PluginBackupService)
- [ ] ✅ **Intégration avec le store** - Recherche et installation depuis le Lumy Store (PluginsStoreService) - **IMPORTANT** : Tous les plugins proviennent du store, nécessite apiToken utilisateur
- [ ] ✅ **Gestion des dépendances** - Résolution et installation des dépendances entre plugins (PluginDependenciesService)
- [ ] ✅ **Système de logging** - Logs isolés par plugin avec niveaux et rotation (PluginLoggerService)
- [ ] ✅ **Validation JSON Schema** - Validation stricte des configurations avec Ajv
- [ ] ✅ **Support Semver** - Gestion des versions avec compatibilité de plages
- [ ] ✅ **Gestion des métadonnées** - Stockage flexible de métadonnées par plugin

---

## Architecture technique

### Backend (NestJS)
- **Entités TypeORM** : Plugin, PluginUIExtension, PluginAutomationExtension, PluginNotification, PluginStorage, PluginError, PluginTest, PluginTestRun, PluginAnalytics, PluginLicense, PluginCertification
- **Entité User** : Ajout du champ `storeApiToken` pour stocker le token API du Lumy Store
- **Services** : 15+ services spécialisés pour chaque fonctionnalité + StoreAuthService, StoreApiService
- **Guards** : JwtAuthGuard pour protéger les endpoints
- **Decorators** : @Public() pour les routes publiques
- **Intégration Store** : Communication avec `https://store.lumy-home.com` via API REST avec authentification par apiToken

### Frontend (React)
- **Hooks** : usePluginRoutes, usePluginMenuItems pour l'intégration dynamique
- **Composants** : PluginComponentLoader, PluginPageLoader pour le chargement dynamique
- **Services** : pluginsService pour les appels API

### Sécurité
- Validation des permissions avant exécution
- Isolation des données par plugin
- Circuit breaker pour prévenir les crashes
- Validation JSON Schema pour les configurations
- Analyse statique du code pour les permissions
- Authentification avec le Lumy Store (apiToken stocké de manière sécurisée)
- Validation et rafraîchissement automatique des tokens store

### Flux d'authentification Store
1. L'utilisateur crée un compte sur `https://store.lumy-home.com`
2. L'utilisateur se connecte depuis Lumy Home avec ses identifiants store
3. Le backend récupère l'apiToken depuis le store et le stocke dans l'entité User
4. Toutes les requêtes vers le store utilisent cet apiToken pour l'authentification
5. Le token est rafraîchi automatiquement si nécessaire

