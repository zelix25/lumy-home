import type { ComponentType } from 'react';
import { SvgIconProps } from '@mui/material';
import {
  Lightbulb,
  Power,
  ElectricalServices,
  Sensors,
  Window,
  Thermostat,
  DirectionsRun,
  RadioButtonChecked,
  RadioButtonUnchecked,
  Blinds,
  WaterDrop,
  Person,
  LightMode,
  LocalFireDepartment,
  Warning,
  BatteryFull,
  MeetingRoom,
  TouchApp,
  ToggleOn,
  SmartButton,
  DoorFront,
  SensorDoor,
  WbSunny,
  AcUnit,
} from '@mui/icons-material';
import { Device } from '../services/devices.service';

export type DeviceIconKey =
  | 'auto'
  | 'lightbulb'
  | 'power'
  | 'plug'
  | 'button'
  | 'smart_button'
  | 'toggle'
  | 'touch'
  | 'blinds'
  | 'thermostat'
  | 'motion'
  | 'person'
  | 'window'
  | 'door'
  | 'sensor_door'
  | 'water'
  | 'smoke'
  | 'battery'
  | 'sensor'
  | 'sun'
  | 'cold'
  | 'warning'
  | 'energy';

export interface DeviceIconOption {
  key: DeviceIconKey;
  labelKey: string;
  Icon: ComponentType<SvgIconProps>;
}

export const DEVICE_ICON_OPTIONS: DeviceIconOption[] = [
  { key: 'auto', labelKey: 'deviceDetail.iconAuto', Icon: Sensors },
  { key: 'lightbulb', labelKey: 'deviceDetail.icons.lightbulb', Icon: Lightbulb },
  { key: 'power', labelKey: 'deviceDetail.icons.power', Icon: Power },
  { key: 'plug', labelKey: 'deviceDetail.icons.plug', Icon: ElectricalServices },
  { key: 'button', labelKey: 'deviceDetail.icons.button', Icon: RadioButtonUnchecked },
  { key: 'smart_button', labelKey: 'deviceDetail.icons.smartButton', Icon: SmartButton },
  { key: 'toggle', labelKey: 'deviceDetail.icons.toggle', Icon: ToggleOn },
  { key: 'touch', labelKey: 'deviceDetail.icons.touch', Icon: TouchApp },
  { key: 'blinds', labelKey: 'deviceDetail.icons.blinds', Icon: Blinds },
  { key: 'thermostat', labelKey: 'deviceDetail.icons.thermostat', Icon: Thermostat },
  { key: 'motion', labelKey: 'deviceDetail.icons.motion', Icon: DirectionsRun },
  { key: 'person', labelKey: 'deviceDetail.icons.person', Icon: Person },
  { key: 'window', labelKey: 'deviceDetail.icons.window', Icon: Window },
  { key: 'door', labelKey: 'deviceDetail.icons.door', Icon: MeetingRoom },
  { key: 'sensor_door', labelKey: 'deviceDetail.icons.sensorDoor', Icon: SensorDoor },
  { key: 'water', labelKey: 'deviceDetail.icons.water', Icon: WaterDrop },
  { key: 'smoke', labelKey: 'deviceDetail.icons.smoke', Icon: LocalFireDepartment },
  { key: 'battery', labelKey: 'deviceDetail.icons.battery', Icon: BatteryFull },
  { key: 'sensor', labelKey: 'deviceDetail.icons.sensor', Icon: Sensors },
  { key: 'sun', labelKey: 'deviceDetail.icons.sun', Icon: WbSunny },
  { key: 'cold', labelKey: 'deviceDetail.icons.cold', Icon: AcUnit },
  { key: 'warning', labelKey: 'deviceDetail.icons.warning', Icon: Warning },
  { key: 'energy', labelKey: 'deviceDetail.icons.energy', Icon: ElectricalServices },
];

const ICON_BY_KEY = Object.fromEntries(
  DEVICE_ICON_OPTIONS.filter((o) => o.key !== 'auto').map((o) => [o.key, o.Icon]),
) as Record<string, ComponentType<SvgIconProps>>;

function resolveDefaultIcon(
  device: Pick<Device, 'type' | 'state'>,
): ComponentType<SvgIconProps> {
  const type = device.type;
  const state = device.state;

  if (type === 'sensor' || type === 'temperature') {
    if (state?.temperature !== undefined) return Thermostat;
    if (state?.humidity !== undefined) return WaterDrop;
    if (
      state?.motion !== undefined ||
      state?.presence !== undefined ||
      state?.occupancy !== undefined
    ) {
      return DirectionsRun;
    }
    if (state?.illuminance !== undefined) return LightMode;
    if (state?.contact !== undefined) return Window;
    if (state?.water_leak !== undefined) return WaterDrop;
    if (state?.smoke !== undefined) return LocalFireDepartment;
    if (state?.vibration !== undefined) return Warning;
    if (state?.battery !== undefined) return BatteryFull;
    return Sensors;
  }

  switch (type) {
    case 'light':
      return Lightbulb;
    case 'switch':
      return Power;
    case 'plug':
      return ElectricalServices;
    case 'energy':
      return ElectricalServices;
    case 'window':
      return Window;
    case 'door':
      return DoorFront;
    case 'cover':
      return Blinds;
    case 'temperature':
      return Thermostat;
    case 'motion':
      return DirectionsRun;
    case 'humidity':
      return WaterDrop;
    case 'illuminance':
      return LightMode;
    case 'presence':
    case 'occupancy':
      return Person;
    case 'contact':
      return Window;
    case 'water_leak':
      return WaterDrop;
    case 'smoke':
      return LocalFireDepartment;
    case 'button':
      return RadioButtonChecked;
    default:
      return Sensors;
  }
}

export function getDeviceIconComponent(
  device: Pick<Device, 'type' | 'state' | 'icon'>,
): ComponentType<SvgIconProps> {
  if (device.icon && ICON_BY_KEY[device.icon]) {
    return ICON_BY_KEY[device.icon];
  }
  return resolveDefaultIcon(device);
}

export function DeviceIcon({
  device,
  sx,
  color,
  fontSize = 48,
}: {
  device: Pick<Device, 'type' | 'state' | 'icon'>;
  sx?: SvgIconProps['sx'];
  color?: string;
  fontSize?: number;
}) {
  const Icon = getDeviceIconComponent(device);
  return <Icon sx={{ fontSize, color, ...sx }} />;
}
