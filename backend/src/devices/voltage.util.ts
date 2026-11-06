/**
 * Zigbee2MQTT publie souvent la tension pile en millivolts (ex. 2800 → 2.80 V),
 * alors que les compteurs énergie envoient la tension secteur en volts (230 / 400 V).
 */
export function normalizeVoltageToVolts(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) {
    return raw;
  }

  if (raw <= 15) {
    return raw;
  }

  if (
    (raw >= 90 && raw <= 140) ||
    (raw >= 180 && raw <= 270) ||
    (raw >= 340 && raw <= 450)
  ) {
    return raw;
  }

  if (raw >= 500 && raw <= 15000) {
    return raw / 1000;
  }

  return raw;
}
