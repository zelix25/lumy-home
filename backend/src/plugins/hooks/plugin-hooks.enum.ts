/**
 * Types d'événements/hooks disponibles pour les plugins
 */
export enum PluginHookType {
  // Événements d'appareils
  DEVICE_UPDATE = 'device:update', // Un appareil a été mis à jour
  DEVICE_STATE_CHANGE = 'device:state_change', // L'état d'un appareil a changé
  DEVICE_ADDED = 'device:added', // Un nouvel appareil a été ajouté
  DEVICE_REMOVED = 'device:removed', // Un appareil a été supprimé
  DEVICE_ONLINE = 'device:online', // Un appareil est passé en ligne
  DEVICE_OFFLINE = 'device:offline', // Un appareil est passé hors ligne

  // Événements d'automations
  AUTOMATION_TRIGGERED = 'automation:triggered', // Une automation a été déclenchée
  AUTOMATION_EXECUTED = 'automation:executed', // Une automation a été exécutée
  AUTOMATION_CREATED = 'automation:created', // Une automation a été créée
  AUTOMATION_UPDATED = 'automation:updated', // Une automation a été mise à jour
  AUTOMATION_DELETED = 'automation:deleted', // Une automation a été supprimée

  // Événements de pièces
  ROOM_CREATED = 'room:created', // Une pièce a été créée
  ROOM_UPDATED = 'room:updated', // Une pièce a été mise à jour
  ROOM_DELETED = 'room:deleted', // Une pièce a été supprimée

  // Événements système
  SYSTEM_STARTUP = 'system:startup', // Démarrage du système
  SYSTEM_SHUTDOWN = 'system:shutdown', // Arrêt du système
  PLUGIN_ENABLED = 'plugin:enabled', // Un plugin a été activé
  PLUGIN_DISABLED = 'plugin:disabled', // Un plugin a été désactivé
  PLUGIN_INSTALLED = 'plugin:installed', // Un plugin a été installé
  PLUGIN_UNINSTALLED = 'plugin:uninstalled', // Un plugin a été désinstallé

  // Événements météo
  WEATHER_UPDATE = 'weather:update', // Les données météo ont été mises à jour

  // Événements personnalisés (pour les plugins qui veulent déclencher leurs propres événements)
  CUSTOM = 'custom', // Événement personnalisé
}

/**
 * Structure d'un événement
 */
export interface PluginEvent {
  type: PluginHookType | string;
  timestamp: Date;
  data: Record<string, any>;
  source?: string; // Source de l'événement (ex: "devices", "automations")
}

/**
 * Structure d'un hook enregistré
 */
export interface PluginHook {
  pluginId: string;
  pluginName: string;
  hookType: PluginHookType | string;
  handlerPath: string; // Chemin vers le fichier handler
  enabled: boolean;
  priority?: number; // Priorité d'exécution (plus bas = exécuté en premier)
}

