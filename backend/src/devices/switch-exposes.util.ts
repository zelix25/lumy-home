/**
 * Helpers pour les switches Zigbee2MQTT multi-endpoints
 * (ex. SONOFF MINI-ZB2GS-L : state_l1 / state_l2 au lieu de state).
 */

export interface SwitchChannel {
  property: string;
  endpoint?: string;
  label: string;
  valueOn: string | boolean;
  valueOff: string | boolean;
}

type ExposeLike = {
  type?: string;
  name?: string;
  property?: string;
  endpoint?: string;
  value_on?: string | boolean;
  value_off?: string | boolean;
  features?: ExposeLike[];
};

const STATE_PROPERTY_RE =
  /^(state|state_l\d+|state_(left|right|top|bottom|center))$/i;

/** Modèles Z2M dual-canal connus (doc officielle state_l1 / state_l2). */
const DUAL_CHANNEL_MODELS = new Set([
  'MINI-ZB2GS',
  'MINI-ZB2GS-L',
  'ZBMINIL2',
  'ZBMINI-L',
]);

function flattenExposes(exposes: ExposeLike[] | undefined): ExposeLike[] {
  const result: ExposeLike[] = [];
  for (const expose of exposes || []) {
    if (expose.features?.length) {
      for (const feature of expose.features) {
        result.push({
          ...feature,
          endpoint: feature.endpoint || expose.endpoint,
        });
      }
    } else {
      result.push(expose);
    }
  }
  return result;
}

function formatChannelLabel(property: string, endpoint?: string): string {
  const match = property.match(/^state_l(\d+)$/i);
  if (match) {
    return `Canal ${match[1]}`;
  }
  if (endpoint && /^l\d+$/i.test(endpoint)) {
    return `Canal ${endpoint.slice(1)}`;
  }
  if (property === 'state') {
    return 'État';
  }
  return property;
}

function isOnOffStateValue(value: unknown): boolean {
  return (
    value === 'ON' ||
    value === 'OFF' ||
    value === true ||
    value === false ||
    value === 'TOGGLE'
  );
}

function dualChannelFallback(): SwitchChannel[] {
  return [
    {
      property: 'state_l1',
      endpoint: 'l1',
      label: 'Canal 1',
      valueOn: 'ON',
      valueOff: 'OFF',
    },
    {
      property: 'state_l2',
      endpoint: 'l2',
      label: 'Canal 2',
      valueOn: 'ON',
      valueOff: 'OFF',
    },
  ];
}

/**
 * Extrait les canaux ON/OFF pilotables depuis les exposes (et fallback sur l'état MQTT).
 */
export function getSwitchChannels(
  exposes?: ExposeLike[] | null,
  state?: Record<string, any> | null,
  model?: string | null,
): SwitchChannel[] {
  const channels: SwitchChannel[] = [];
  const seen = new Set<string>();

  for (const feature of flattenExposes(exposes || undefined)) {
    const property = feature.property || feature.name;
    if (!property || seen.has(property)) {
      continue;
    }

    const looksLikeState =
      STATE_PROPERTY_RE.test(property) ||
      (feature.name === 'state' && feature.type === 'binary');

    if (!looksLikeState) {
      continue;
    }

    if (feature.type && feature.type !== 'binary') {
      continue;
    }

    seen.add(property);
    channels.push({
      property,
      endpoint: feature.endpoint,
      label: formatChannelLabel(property, feature.endpoint),
      valueOn: feature.value_on ?? 'ON',
      valueOff: feature.value_off ?? 'OFF',
    });
  }

  if (channels.length === 0 && state) {
    for (const property of Object.keys(state)) {
      if (!STATE_PROPERTY_RE.test(property) || seen.has(property)) {
        continue;
      }
      if (!isOnOffStateValue(state[property])) {
        continue;
      }
      seen.add(property);
      channels.push({
        property,
        label: formatChannelLabel(property),
        valueOn: 'ON',
        valueOff: 'OFF',
      });
    }
  }

  const normalizedModel = (model || '').trim().toUpperCase();
  const looksLikeGenericOnly =
    channels.length === 0 ||
    (channels.length === 1 &&
      channels[0].property === 'state' &&
      state?.state === undefined);

  if (looksLikeGenericOnly && DUAL_CHANNEL_MODELS.has(normalizedModel)) {
    return dualChannelFallback();
  }

  if (channels.length === 0) {
    channels.push({
      property: 'state',
      label: 'État',
      valueOn: 'ON',
      valueOff: 'OFF',
    });
  }

  return channels.sort((a, b) => a.property.localeCompare(b.property, undefined, { numeric: true }));
}

export function isChannelOn(
  state: Record<string, any> | null | undefined,
  channel: SwitchChannel,
): boolean {
  const value = state?.[channel.property];
  return value === channel.valueOn || value === true || value === 'ON';
}

export function isAnySwitchOn(
  state: Record<string, any> | null | undefined,
  exposes?: ExposeLike[] | null,
  model?: string | null,
): boolean {
  return getSwitchChannels(exposes, state, model).some((channel) =>
    isChannelOn(state, channel),
  );
}

export function buildOnOffCommand(
  exposes: ExposeLike[] | null | undefined,
  state: Record<string, any> | null | undefined,
  on: boolean,
  property?: string,
  model?: string | null,
): Record<string, any> {
  const channels = getSwitchChannels(exposes, state, model);
  const target = property
    ? channels.filter((channel) => channel.property === property)
    : channels;

  const command: Record<string, any> = {};
  for (const channel of target.length > 0 ? target : channels) {
    command[channel.property] = on ? channel.valueOn : channel.valueOff;
  }

  if (property && Object.keys(command).length === 0) {
    command[property] = on ? 'ON' : 'OFF';
  }

  return command;
}

export function buildGetStatePayload(
  exposes: ExposeLike[] | null | undefined,
  state?: Record<string, any> | null,
  model?: string | null,
): Record<string, any> {
  const payload: Record<string, any> = {};
  for (const channel of getSwitchChannels(exposes, state, model)) {
    payload[channel.property] = '';
  }
  return payload;
}

/**
 * Si le client envoie encore { state: "ON"|"OFF"|"TOGGLE" } alors que l'appareil
 * utilise state_l1/state_l2 (etc.), on étend la commande aux vrais propriétés.
 */
export function expandGenericStateCommand(
  command: Record<string, any>,
  exposes?: ExposeLike[] | null,
  state?: Record<string, any> | null,
  model?: string | null,
): Record<string, any> {
  if (!Object.prototype.hasOwnProperty.call(command, 'state')) {
    return command;
  }

  const channels = getSwitchChannels(exposes, state, model);
  const usesGenericStateOnly =
    channels.length === 1 && channels[0].property === 'state';

  if (usesGenericStateOnly) {
    return command;
  }

  const { state: stateValue, ...rest } = command;
  const expanded: Record<string, any> = { ...rest };

  if (stateValue === 'TOGGLE') {
    for (const channel of channels) {
      expanded[channel.property] = 'TOGGLE';
    }
    return expanded;
  }

  const on = stateValue === 'ON' || stateValue === true;
  return {
    ...expanded,
    ...buildOnOffCommand(exposes, state, on, undefined, model),
  };
}
