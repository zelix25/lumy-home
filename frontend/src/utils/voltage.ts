/**
 * Zigbee2MQTT publie souvent la tension pile en millivolts (ex. 2800 → 2.80 V),
 * alors que les compteurs / modules énergie envoient la tension secteur en volts
 * (ex. 230 V, 400 V).
 *
 * On normalise uniquement selon l'ordre de grandeur — jamais selon le type d'appareil.
 */
export function normalizeVoltageToVolts(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) {
    return raw;
  }

  // Déjà en volts (pile / petit pack)
  if (raw <= 15) {
    return raw;
  }

  // Tension secteur typique (US / EU monophasé / triphasé)
  if (
    (raw >= 90 && raw <= 140) ||
    (raw >= 180 && raw <= 270) ||
    (raw >= 340 && raw <= 450)
  ) {
    return raw;
  }

  // Millivolts pile (Zigbee) : ~0.5 V à ~15 V exprimés en mV
  if (raw >= 500 && raw <= 15000) {
    return raw / 1000;
  }

  return raw;
}

export function formatVoltage(
  raw: unknown,
  options?: { digits?: number; unit?: boolean },
): string {
  const digits = options?.digits ?? 2;
  const withUnit = options?.unit ?? true;
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!Number.isFinite(num)) {
    return withUnit ? `${raw} V` : String(raw);
  }
  const volts = normalizeVoltageToVolts(num);
  const text = volts.toFixed(digits);
  return withUnit ? `${text} V` : text;
}
