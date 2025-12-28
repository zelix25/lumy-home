/**
 * Handler pour l'événement device:update
 * 
 * Cet exemple montre comment réagir aux mises à jour d'appareils
 */
module.exports = async function(event) {
  const { type, timestamp, data, source } = event;
  
  // Vérifier que les données nécessaires sont présentes
  if (!data || !data.deviceId || !data.deviceName) {
    lumy.logger.warn('Données d\'appareil incomplètes dans l\'événement');
    return;
  }
  
  const { deviceId, deviceName, state } = data;
  
  // Logger l'événement
  lumy.logger.info(`Appareil ${deviceName} (${deviceId}) mis à jour`);
  
  // Exemple : Envoyer une notification si la température est élevée
  if (state && state.temperature) {
    if (state.temperature > 25) {
      await lumy.notifications.send({
        title: "Température élevée",
        message: `La température dans ${deviceName} est de ${state.temperature}°C`,
        level: "warning"
      });
    }
  }
  
  // Exemple : Logger si une lumière est allumée à plus de 80%
  if (state && state.on && state.brightness > 80) {
    lumy.logger.warn(`Lumière forte détectée: ${deviceName} à ${state.brightness}%`);
  }
};

