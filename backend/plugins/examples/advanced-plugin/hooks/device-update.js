/**
 * Handler pour l'événement device:update
 */
module.exports = async function(event) {
  const { data } = event;
  
  if (!data || !data.deviceId) {
    return;
  }
  
  // Récupérer la configuration depuis le stockage
  const config = await lumy.storage.get('pluginConfig');
  if (!config) {
    return;
  }
  
  // Vérifier la température si c'est un capteur
  if (data.state && data.state.temperature) {
    const temp = data.state.temperature;
    
    if (temp > config.threshold) {
      lumy.logger.warn(`[Hook] Température élevée: ${data.deviceName} à ${temp}°C`);
    }
  }
};

