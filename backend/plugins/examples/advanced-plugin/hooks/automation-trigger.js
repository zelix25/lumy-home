/**
 * Handler pour l'événement automation:triggered
 */
module.exports = async function(event) {
  const { data } = event;
  
  lumy.logger.info(`Automation déclenchée: ${data.automationName || data.automationId}`);
  
  // Logger les détails de l'automation
  if (data.trigger) {
    lumy.logger.debug('Déclencheur:', data.trigger);
  }
  
  if (data.action) {
    lumy.logger.debug('Action:', data.action);
  }
};

