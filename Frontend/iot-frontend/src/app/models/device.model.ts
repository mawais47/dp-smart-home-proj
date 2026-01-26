export interface DeviceMessage {
  deviceId: string;
  payload: string;
  topic: string;
  timestamp: string;
}

export interface DeviceStatus {
  id: string;
  lastSeen: Date;
  online: boolean;
  interval: number;
  message?: string;
}

export interface DeviceGroup {
  id: string;
  name: string;
  deviceIds: string[];
}
