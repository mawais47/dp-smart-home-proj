export interface DeviceMessage {
  deviceId: string;
  payload: string;
  topic: string;
  timestamp: string;
}

export interface DeviceType {
  id: string;
  label: string;
}

export const DEVICE_TYPES: DeviceType[] = [
  { id: 'bulb', label: 'Bulb' },
  { id: 'fan', label: 'Fan' },
  { id: 'ac', label: 'AC' },
  { id: 'tv', label: 'TV' },
  { id: 'automatic_cleaner', label: 'Automatic Cleaner' },
  { id: 'curtains', label: 'Curtains' },
];

export interface DeviceStatus {
  id: string;
  type?: string;
  lastSeen: Date;
  online: boolean;
  interval: number;
  message?: string;
  brightness?: number;
  speed?: number;
  temperature?: number;
  curtainPosition?: 'full' | 'half' | '0';
  power?: 'on' | 'off';
}

export interface DeviceGroup {
  id: string;
  name: string;
  deviceIds: string[];
}

export interface StoredDevice {
  id: string;
  type: string;
  interval: number;
  brightness?: number;
  speed?: number;
  temperature?: number;
  curtainPosition?: 'full' | 'half' | '0';
  power: string;
}
