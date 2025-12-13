import { AutomationTriggerType, AutomationActionType } from '../services/simple-automations.service';

export interface Device {
  ieeeAddress: string;
  friendlyName: string;
  type: string;
  status: string;
  isSupported: boolean;
  room?: string | null;
  state?: Record<string, any> | null;
}

/**
 * Retourne les types d'appareils compatibles avec un type de déclencheur
 */
function getCompatibleDeviceTypesForTrigger(triggerType: AutomationTriggerType): string[] {
  const mapping: Record<AutomationTriggerType, string[]> = {
    [AutomationTriggerType.MOTION]: ['motion', 'sensor'],
    [AutomationTriggerType.CONTACT]: ['door', 'window'],
    [AutomationTriggerType.BUTTON]: ['button', 'switch'],
    [AutomationTriggerType.TEMPERATURE]: ['temperature', 'sensor'],
    [AutomationTriggerType.ILLUMINANCE]: ['sensor', 'temperature'], // Les capteurs de température incluent souvent la luminosité
    [AutomationTriggerType.HUMIDITY]: ['temperature', 'sensor'], // Les capteurs de température incluent souvent l'humidité
    [AutomationTriggerType.VIBRATION]: ['sensor'],
    [AutomationTriggerType.WATER_LEAK]: ['sensor'],
    [AutomationTriggerType.SMOKE]: ['sensor'],
    [AutomationTriggerType.GAS]: ['sensor'],
    [AutomationTriggerType.SUNRISE_SUNSET]: [], // Aucun appareil nécessaire
    [AutomationTriggerType.TIME]: [], // Aucun appareil nécessaire
    [AutomationTriggerType.MANUAL]: [], // Aucun appareil nécessaire
  };

  return mapping[triggerType] || [];
}

/**
 * Vérifie si un appareil est compatible avec un type de déclencheur
 */
function isDeviceCompatibleWithTrigger(device: Device, triggerType: AutomationTriggerType): boolean {
  // Les déclencheurs sans appareil nécessaire sont toujours compatibles
  if (
    triggerType === AutomationTriggerType.SUNRISE_SUNSET ||
    triggerType === AutomationTriggerType.TIME ||
    triggerType === AutomationTriggerType.MANUAL
  ) {
    return false; // Pas besoin d'appareil
  }

  const compatibleTypes = getCompatibleDeviceTypesForTrigger(triggerType);
  const deviceType = device.type.toLowerCase();

  // Vérifier si le type d'appareil correspond
  if (compatibleTypes.includes(deviceType)) {
    return true;
  }

  // Vérifications spéciales pour les capteurs multi-fonctions
  if (deviceType === 'sensor' || deviceType === 'temperature') {
    // Vérifier si l'appareil a les capacités nécessaires dans son état
    const state = device.state || {};
    
    if (triggerType === AutomationTriggerType.ILLUMINANCE) {
      return 'illuminance' in state || device.type.toLowerCase().includes('illuminance');
    }
    
    if (triggerType === AutomationTriggerType.HUMIDITY) {
      return 'humidity' in state || device.type.toLowerCase().includes('humidity');
    }
    
    if (triggerType === AutomationTriggerType.TEMPERATURE) {
      return 'temperature' in state || device.type.toLowerCase().includes('temperature');
    }
    
    if (triggerType === AutomationTriggerType.VIBRATION) {
      return 'vibration' in state;
    }
    
    if (triggerType === AutomationTriggerType.WATER_LEAK) {
      return 'water_leak' in state || 'water' in state;
    }
    
    if (triggerType === AutomationTriggerType.SMOKE) {
      return 'smoke' in state || 'smoke_detected' in state;
    }
    
    if (triggerType === AutomationTriggerType.GAS) {
      return 'gas' in state || 'gas_detected' in state;
    }
    
    // Pour les capteurs génériques, vérifier s'ils ont la capacité de mouvement
    if (triggerType === AutomationTriggerType.MOTION) {
      return 'occupancy' in state || 'presence' in state || 'motion' in state;
    }
  }

  return false;
}

/**
 * Filtre les appareils compatibles avec un type de déclencheur
 */
export function getCompatibleDevicesForTrigger(
  devices: Device[],
  triggerType: AutomationTriggerType,
): Device[] {
  // Pour les déclencheurs sans appareil nécessaire, retourner un tableau vide
  if (
    triggerType === AutomationTriggerType.SUNRISE_SUNSET ||
    triggerType === AutomationTriggerType.TIME ||
    triggerType === AutomationTriggerType.MANUAL
  ) {
    return [];
  }

  return devices.filter((device) => {
    // Ne retourner que les appareils en ligne et supportés
    if (device.status !== 'online' || !device.isSupported) {
      return false;
    }
    return isDeviceCompatibleWithTrigger(device, triggerType);
  });
}

/**
 * Retourne les types d'appareils compatibles avec un type d'action
 */
function getCompatibleDeviceTypesForAction(actionType: AutomationActionType): string[] {
  const mapping: Record<AutomationActionType, string[]> = {
    [AutomationActionType.TURN_ON]: ['light', 'switch', 'plug'],
    [AutomationActionType.TURN_OFF]: ['light', 'switch', 'plug'],
    [AutomationActionType.TOGGLE]: ['light', 'switch', 'plug'],
    [AutomationActionType.SET_BRIGHTNESS]: ['light'],
    [AutomationActionType.SET_COLOR]: ['light'],
    [AutomationActionType.SET_COLOR_TEMP]: ['light'],
    [AutomationActionType.SET_THERMOSTAT]: ['sensor', 'temperature'], // Pour les thermostats
    [AutomationActionType.OPEN_COVER]: ['cover'],
    [AutomationActionType.CLOSE_COVER]: ['cover'],
    [AutomationActionType.NOTIFY]: [], // Pas d'appareil nécessaire
  };

  return mapping[actionType] || [];
}

/**
 * Filtre les appareils compatibles avec un type d'action
 */
export function getCompatibleDevicesForAction(
  devices: Device[],
  actionType: AutomationActionType,
): Device[] {
  // Pour les actions sans appareil nécessaire, retourner un tableau vide
  if (actionType === AutomationActionType.NOTIFY) {
    return [];
  }

  const compatibleTypes = getCompatibleDeviceTypesForAction(actionType);

  return devices.filter((device) => {
    // Ne retourner que les appareils en ligne et supportés
    if (device.status !== 'online' || !device.isSupported) {
      return false;
    }
    return compatibleTypes.includes(device.type.toLowerCase());
  });
}

/**
 * Retourne une description du type de déclencheur pour l'utilisateur
 */
export function getTriggerDescription(triggerType: AutomationTriggerType): string {
  const descriptions: Record<AutomationTriggerType, string> = {
    [AutomationTriggerType.MOTION]: 'Détecte un mouvement dans la pièce',
    [AutomationTriggerType.CONTACT]: 'Détecte l\'ouverture ou la fermeture d\'une porte/fenêtre',
    [AutomationTriggerType.BUTTON]: 'Détecte l\'appui sur un bouton ou un interrupteur',
    [AutomationTriggerType.TEMPERATURE]: 'Détecte un changement de température',
    [AutomationTriggerType.ILLUMINANCE]: 'Détecte un changement de luminosité',
    [AutomationTriggerType.HUMIDITY]: 'Détecte un changement d\'humidité',
    [AutomationTriggerType.VIBRATION]: 'Détecte une vibration',
    [AutomationTriggerType.WATER_LEAK]: 'Détecte une fuite d\'eau',
    [AutomationTriggerType.SMOKE]: 'Détecte de la fumée',
    [AutomationTriggerType.GAS]: 'Détecte du gaz',
    [AutomationTriggerType.SUNRISE_SUNSET]: 'Se déclenche au lever ou au coucher du soleil',
    [AutomationTriggerType.TIME]: 'Se déclenche à une heure précise',
    [AutomationTriggerType.MANUAL]: 'Se déclenche manuellement depuis l\'application',
  };

  return descriptions[triggerType] || '';
}

