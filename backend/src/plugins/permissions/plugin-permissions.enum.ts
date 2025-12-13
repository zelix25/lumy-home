/**
 * Permissions disponibles pour les plugins
 * Chaque permission définit une capacité que le plugin peut demander
 */
export enum PluginPermission {
  // Permissions de lecture
  READ_DEVICES = 'read:devices', // Lire la liste des appareils
  READ_DEVICE_STATE = 'read:device_state', // Lire l'état d'un appareil
  READ_ROOMS = 'read:rooms', // Lire la liste des pièces
  READ_AUTOMATIONS = 'read:automations', // Lire les automations
  READ_SETTINGS = 'read:settings', // Lire les paramètres
  READ_WEATHER = 'read:weather', // Lire les données météo
  READ_HISTORY = 'read:history', // Lire l'historique

  // Permissions d'écriture
  WRITE_DEVICES = 'write:devices', // Modifier les appareils
  CONTROL_DEVICES = 'control:devices', // Contrôler les appareils (allumer, éteindre, etc.)
  WRITE_AUTOMATIONS = 'write:automations', // Créer/modifier des automations
  WRITE_SETTINGS = 'write:settings', // Modifier les paramètres
  WRITE_ROOMS = 'write:rooms', // Modifier les pièces

  // Permissions système
  SYSTEM_RESTART = 'system:restart', // Redémarrer le système
  SYSTEM_SHUTDOWN = 'system:shutdown', // Arrêter le système
  SYSTEM_UPDATE = 'system:update', // Mettre à jour le système

  // Permissions réseau
  NETWORK_HTTP = 'network:http', // Faire des requêtes HTTP
  NETWORK_MQTT = 'network:mqtt', // Publier/s'abonner à MQTT
  NETWORK_WEBSOCKET = 'network:websocket', // Utiliser WebSocket

  // Permissions de stockage
  STORAGE_READ = 'storage:read', // Lire le stockage
  STORAGE_WRITE = 'storage:write', // Écrire dans le stockage

  // Permissions de notification
  NOTIFICATIONS_SEND = 'notifications:send', // Envoyer des notifications

  // Permissions d'interface
  UI_ADD_PAGES = 'ui:add_pages', // Ajouter des pages à l'interface
  UI_ADD_COMPONENTS = 'ui:add_components', // Ajouter des composants

  // Permissions avancées
  EXECUTE_SCRIPTS = 'execute:scripts', // Exécuter des scripts
  ACCESS_FILESYSTEM = 'access:filesystem', // Accéder au système de fichiers
}

/**
 * Catégories de permissions pour faciliter la gestion
 */
export enum PermissionCategory {
  READ = 'read',
  WRITE = 'write',
  SYSTEM = 'system',
  NETWORK = 'network',
  STORAGE = 'storage',
  NOTIFICATIONS = 'notifications',
  UI = 'ui',
  ADVANCED = 'advanced',
}

/**
 * Mapping des permissions vers leurs catégories
 */
export const PermissionCategoryMap: Record<PluginPermission, PermissionCategory> = {
  [PluginPermission.READ_DEVICES]: PermissionCategory.READ,
  [PluginPermission.READ_DEVICE_STATE]: PermissionCategory.READ,
  [PluginPermission.READ_ROOMS]: PermissionCategory.READ,
  [PluginPermission.READ_AUTOMATIONS]: PermissionCategory.READ,
  [PluginPermission.READ_SETTINGS]: PermissionCategory.READ,
  [PluginPermission.READ_WEATHER]: PermissionCategory.READ,
  [PluginPermission.READ_HISTORY]: PermissionCategory.READ,

  [PluginPermission.WRITE_DEVICES]: PermissionCategory.WRITE,
  [PluginPermission.CONTROL_DEVICES]: PermissionCategory.WRITE,
  [PluginPermission.WRITE_AUTOMATIONS]: PermissionCategory.WRITE,
  [PluginPermission.WRITE_SETTINGS]: PermissionCategory.WRITE,
  [PluginPermission.WRITE_ROOMS]: PermissionCategory.WRITE,

  [PluginPermission.SYSTEM_RESTART]: PermissionCategory.SYSTEM,
  [PluginPermission.SYSTEM_SHUTDOWN]: PermissionCategory.SYSTEM,
  [PluginPermission.SYSTEM_UPDATE]: PermissionCategory.SYSTEM,

  [PluginPermission.NETWORK_HTTP]: PermissionCategory.NETWORK,
  [PluginPermission.NETWORK_MQTT]: PermissionCategory.NETWORK,
  [PluginPermission.NETWORK_WEBSOCKET]: PermissionCategory.NETWORK,

  [PluginPermission.STORAGE_READ]: PermissionCategory.STORAGE,
  [PluginPermission.STORAGE_WRITE]: PermissionCategory.STORAGE,

  [PluginPermission.NOTIFICATIONS_SEND]: PermissionCategory.NOTIFICATIONS,

  [PluginPermission.UI_ADD_PAGES]: PermissionCategory.UI,
  [PluginPermission.UI_ADD_COMPONENTS]: PermissionCategory.UI,

  [PluginPermission.EXECUTE_SCRIPTS]: PermissionCategory.ADVANCED,
  [PluginPermission.ACCESS_FILESYSTEM]: PermissionCategory.ADVANCED,
};

/**
 * Descriptions des permissions pour l'interface utilisateur
 */
export const PermissionDescriptions: Record<PluginPermission, string> = {
  [PluginPermission.READ_DEVICES]: 'Lire la liste des appareils',
  [PluginPermission.READ_DEVICE_STATE]: "Lire l'état d'un appareil",
  [PluginPermission.READ_ROOMS]: 'Lire la liste des pièces',
  [PluginPermission.READ_AUTOMATIONS]: 'Lire les automations',
  [PluginPermission.READ_SETTINGS]: 'Lire les paramètres',
  [PluginPermission.READ_WEATHER]: 'Lire les données météo',
  [PluginPermission.READ_HISTORY]: "Lire l'historique",
  [PluginPermission.WRITE_DEVICES]: 'Modifier les appareils',
  [PluginPermission.CONTROL_DEVICES]: 'Contrôler les appareils',
  [PluginPermission.WRITE_AUTOMATIONS]: 'Créer/modifier des automations',
  [PluginPermission.WRITE_SETTINGS]: 'Modifier les paramètres',
  [PluginPermission.WRITE_ROOMS]: 'Modifier les pièces',
  [PluginPermission.SYSTEM_RESTART]: 'Redémarrer le système',
  [PluginPermission.SYSTEM_SHUTDOWN]: "Arrêter le système",
  [PluginPermission.SYSTEM_UPDATE]: 'Mettre à jour le système',
  [PluginPermission.NETWORK_HTTP]: 'Faire des requêtes HTTP',
  [PluginPermission.NETWORK_MQTT]: 'Publier/s\'abonner à MQTT',
  [PluginPermission.NETWORK_WEBSOCKET]: 'Utiliser WebSocket',
  [PluginPermission.STORAGE_READ]: 'Lire le stockage',
  [PluginPermission.STORAGE_WRITE]: 'Écrire dans le stockage',
  [PluginPermission.NOTIFICATIONS_SEND]: 'Envoyer des notifications',
  [PluginPermission.UI_ADD_PAGES]: 'Ajouter des pages à l\'interface',
  [PluginPermission.UI_ADD_COMPONENTS]: 'Ajouter des composants',
  [PluginPermission.EXECUTE_SCRIPTS]: 'Exécuter des scripts',
  [PluginPermission.ACCESS_FILESYSTEM]: 'Accéder au système de fichiers',
};

/**
 * Niveaux de risque des permissions
 */
export enum PermissionRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Mapping des permissions vers leurs niveaux de risque
 */
export const PermissionRiskMap: Record<PluginPermission, PermissionRiskLevel> = {
  [PluginPermission.READ_DEVICES]: PermissionRiskLevel.LOW,
  [PluginPermission.READ_DEVICE_STATE]: PermissionRiskLevel.LOW,
  [PluginPermission.READ_ROOMS]: PermissionRiskLevel.LOW,
  [PluginPermission.READ_AUTOMATIONS]: PermissionRiskLevel.LOW,
  [PluginPermission.READ_SETTINGS]: PermissionRiskLevel.LOW,
  [PluginPermission.READ_WEATHER]: PermissionRiskLevel.LOW,
  [PluginPermission.READ_HISTORY]: PermissionRiskLevel.LOW,

  [PluginPermission.WRITE_DEVICES]: PermissionRiskLevel.MEDIUM,
  [PluginPermission.CONTROL_DEVICES]: PermissionRiskLevel.MEDIUM,
  [PluginPermission.WRITE_AUTOMATIONS]: PermissionRiskLevel.MEDIUM,
  [PluginPermission.WRITE_SETTINGS]: PermissionRiskLevel.MEDIUM,
  [PluginPermission.WRITE_ROOMS]: PermissionRiskLevel.MEDIUM,

  [PluginPermission.SYSTEM_RESTART]: PermissionRiskLevel.HIGH,
  [PluginPermission.SYSTEM_SHUTDOWN]: PermissionRiskLevel.HIGH,
  [PluginPermission.SYSTEM_UPDATE]: PermissionRiskLevel.HIGH,

  [PluginPermission.NETWORK_HTTP]: PermissionRiskLevel.MEDIUM,
  [PluginPermission.NETWORK_MQTT]: PermissionRiskLevel.MEDIUM,
  [PluginPermission.NETWORK_WEBSOCKET]: PermissionRiskLevel.MEDIUM,

  [PluginPermission.STORAGE_READ]: PermissionRiskLevel.LOW,
  [PluginPermission.STORAGE_WRITE]: PermissionRiskLevel.MEDIUM,

  [PluginPermission.NOTIFICATIONS_SEND]: PermissionRiskLevel.LOW,

  [PluginPermission.UI_ADD_PAGES]: PermissionRiskLevel.LOW,
  [PluginPermission.UI_ADD_COMPONENTS]: PermissionRiskLevel.LOW,

  [PluginPermission.EXECUTE_SCRIPTS]: PermissionRiskLevel.CRITICAL,
  [PluginPermission.ACCESS_FILESYSTEM]: PermissionRiskLevel.CRITICAL,
};

