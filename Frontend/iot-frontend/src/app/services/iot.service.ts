import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { DeviceMessage, StoredDevice } from '../models/device.model';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class IotService {
  private socket?: WebSocket;
  private messageSubject = new Subject<DeviceMessage>();
  public messages$ = this.messageSubject.asObservable();

  constructor(
    private http: HttpClient,
    private ngZone: NgZone,
    private auth: AuthService,
  ) {}

  connect() {
    if (!this.auth.isAuthenticated || !this.auth.sessionId) {
      return;
    }

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsBase = environment.wsUrl.replace(/\/ws$/, '');
    const wsUrl = `${wsBase}/ws?session_id=${encodeURIComponent(this.auth.sessionId!)}`;

    this.socket = new WebSocket(wsUrl);
    this.socket.onmessage = (event) => {
      this.ngZone.run(() => {
        this.messageSubject.next(JSON.parse(event.data));
      });
    };
    this.socket.onclose = () => {
      this.socket = undefined;
      if (this.auth.isAuthenticated && this.auth.sessionId) {
        setTimeout(() => this.ngZone.run(() => this.connect()), 2000);
      }
    };
  }

  disconnect() {
    this.socket?.close();
    this.socket = undefined;
  }

  sendCommand(deviceId: string, action: string) {
    return this.http.post<{ device?: StoredDevice }>(`${environment.apiBaseUrl}/api/command`, { deviceId, payload: action });
  }

  getDevices() {
    return this.http.get<StoredDevice[]>(`${environment.apiBaseUrl}/api/devices`);
  }

  registerDevice(deviceId: string, deviceType: string) {
    return this.http.post<{ device: StoredDevice }>(`${environment.apiBaseUrl}/api/devices`, { deviceId, deviceType });
  }

  deleteDevice(deviceId: string) {
    return this.http.post(`${environment.apiBaseUrl}/api/devices/delete`, { deviceId });
  }
}
