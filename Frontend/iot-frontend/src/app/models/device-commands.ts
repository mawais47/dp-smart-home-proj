import { DeviceStatus } from './device.model';

export interface ParsedCommand {
  mqttPayload: string;
  displayText: string;
  stateUpdate: Partial<DeviceStatus>;
}

export function getDefaultDeviceState(type: string): Partial<DeviceStatus> {
  switch (type) {
    case 'bulb':
      return { brightness: 100, power: 'on' };
    case 'fan':
      return { speed: 1, power: 'on' };
    case 'ac':
      return { temperature: 24, power: 'on' };
    case 'curtains':
      return { curtainPosition: 'full' };
    case 'automatic_cleaner':
      return { speed: 1, power: 'on' };
    default:
      return {};
  }
}

export function parseDeviceCommand(type: string | undefined, input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed || !type) return null;

  const upper = trimmed.toUpperCase();

  if (upper === 'ON' || upper === 'ONLINE') {
    return { mqttPayload: 'ONLINE', displayText: 'Turned ON', stateUpdate: { power: 'on', online: true } };
  }
  if (upper === 'OFF' || upper === 'OFFLINE') {
    return { mqttPayload: 'OFFLINE', displayText: 'Turned OFF', stateUpdate: { power: 'off', online: false } };
  }

  switch (type) {
    case 'bulb': {
      if (/^\d+$/.test(trimmed)) {
        const brightness = clamp(parseInt(trimmed, 10), 0, 100);
        return {
          mqttPayload: `BRIGHTNESS_${brightness}`,
          displayText: `Brightness set to ${brightness}%`,
          stateUpdate: { brightness, power: brightness > 0 ? 'on' : 'off' },
        };
      }
      break;
    }
    case 'fan': {
      if (/^[1-5]$/.test(trimmed)) {
        const speed = parseInt(trimmed, 10);
        return {
          mqttPayload: `SPEED_${speed}`,
          displayText: `Speed set to ${speed}`,
          stateUpdate: { speed, power: 'on' },
        };
      }
      break;
    }
    case 'ac': {
      if (/^\d+$/.test(trimmed)) {
        const temperature = clamp(parseInt(trimmed, 10), 16, 30);
        return {
          mqttPayload: `TEMP_${temperature}`,
          displayText: `Temperature set to ${temperature}°C`,
          stateUpdate: { temperature, power: 'on' },
        };
      }
      break;
    }
    case 'curtains': {
      if (upper === 'FULL') {
        return {
          mqttPayload: 'CURTAIN_FULL',
          displayText: 'Curtains opened fully',
          stateUpdate: { curtainPosition: 'full' },
        };
      }
      if (upper === 'HALF') {
        return {
          mqttPayload: 'CURTAIN_HALF',
          displayText: 'Curtains set to half',
          stateUpdate: { curtainPosition: 'half' },
        };
      }
      if (trimmed === '0' || upper === 'CLOSED') {
        return {
          mqttPayload: 'CURTAIN_0',
          displayText: 'Curtains closed',
          stateUpdate: { curtainPosition: '0' },
        };
      }
      break;
    }
    case 'automatic_cleaner': {
      if (/^[1-3]$/.test(trimmed)) {
        const speed = parseInt(trimmed, 10);
        return {
          mqttPayload: `SPEED_${speed}`,
          displayText: `Speed set to ${speed}`,
          stateUpdate: { speed, power: 'on' },
        };
      }
      break;
    }
  }

  return null;
}

export function applyStatusPayload(device: DeviceStatus, payload: string): Partial<DeviceStatus> {
  const upper = payload.toUpperCase();

  if (upper === 'ONLINE') return { online: true, power: 'on' };
  if (upper === 'OFFLINE') return { online: false, power: 'off' };

  if (upper.startsWith('BRIGHTNESS:') || upper.startsWith('BRIGHTNESS_')) {
    const value = extractNumber(payload);
    if (value !== null) return { brightness: clamp(value, 0, 100) };
  }
  if (upper.startsWith('SPEED:') || upper.startsWith('SPEED_')) {
    const value = extractNumber(payload);
    if (value !== null) return { speed: value };
  }
  if (upper.startsWith('TEMP:') || upper.startsWith('TEMP_')) {
    const value = extractNumber(payload);
    if (value !== null) return { temperature: value };
  }
  if (upper.startsWith('CURTAIN:') || upper.startsWith('CURTAIN_')) {
    const position = payload.split(/[:_]/)[1]?.toLowerCase();
    if (position === 'full' || position === 'half' || position === '0') {
      return { curtainPosition: position as DeviceStatus['curtainPosition'] };
    }
  }

  return {};
}

export function shouldSkipChatMessage(_payload: string, _isOutgoing: boolean): boolean {
  return false;
}

export function formatDeviceAckMessage(payload: string): string | null {
  if (payload === 'RECEIVED') {
    return 'ACK: RECEIVED';
  }
  if (payload === 'ONLINE') {
    return 'ACK: Device online';
  }
  if (payload === 'OFFLINE') {
    return 'ACK: Device offline';
  }

  const upper = payload.toUpperCase();

  if (upper.startsWith('BRIGHTNESS:') || upper.startsWith('BRIGHTNESS_')) {
    const value = extractNumber(payload);
    if (value !== null) return `ACK: Brightness confirmed at ${value}%`;
  }
  if (upper.startsWith('SPEED:') || upper.startsWith('SPEED_')) {
    const value = extractNumber(payload);
    if (value !== null) return `ACK: Speed confirmed at ${value}`;
  }
  if (upper.startsWith('TEMP:') || upper.startsWith('TEMP_')) {
    const value = extractNumber(payload);
    if (value !== null) return `ACK: Temperature confirmed at ${value}°C`;
  }
  if (upper.startsWith('CURTAIN:') || upper.startsWith('CURTAIN_')) {
    const position = payload.split(/[:_]/)[1]?.toLowerCase();
    if (position === 'full') return 'ACK: Curtains confirmed fully open';
    if (position === 'half') return 'ACK: Curtains confirmed at half';
    if (position === '0') return 'ACK: Curtains confirmed closed';
  }

  return null;
}

export function getDeviceStateSummary(device?: DeviceStatus): string {
  if (!device) return '';

  switch (device.type) {
    case 'bulb':
      return `Brightness ${device.brightness ?? 100}%`;
    case 'fan':
      return `Speed ${device.speed ?? 1}/5`;
    case 'ac':
      return `${device.temperature ?? 24}°C`;
    case 'curtains':
      return `Position ${formatCurtain(device.curtainPosition ?? 'full')}`;
    case 'automatic_cleaner':
      return `Speed ${device.speed ?? 1}/3`;
    default:
      return device.online ? 'Online' : 'Offline';
  }
}

export function getChatPlaceholder(type?: string): string {
  switch (type) {
    case 'bulb':
      return 'ON, OFF, or brightness 0-100 (e.g. 20)';
    case 'fan':
      return 'ON, OFF, or speed 1-5';
    case 'ac':
      return 'ON, OFF, or temperature 16-30';
    case 'curtains':
      return 'FULL, HALF, or 0';
    case 'automatic_cleaner':
      return 'ON, OFF, or speed 1-3';
    default:
      return 'Command...';
  }
}

function formatCurtain(position: string): string {
  if (position === '0') return 'Closed';
  if (position === 'half') return 'Half';
  return 'Full';
}

function extractNumber(payload: string): number | null {
  const match = payload.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
