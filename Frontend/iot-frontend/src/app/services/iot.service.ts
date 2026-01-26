import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { DeviceMessage } from '../models/device.model';

@Injectable({ providedIn: 'root' })
export class IotService {
  private socket!: WebSocket;
  private messageSubject = new Subject<DeviceMessage>();
  public messages$ = this.messageSubject.asObservable();

  constructor(private http: HttpClient, private ngZone: NgZone) {
    this.connect();
  }

  private connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.socket = new WebSocket('ws://localhost:8080/ws');
    this.socket.onmessage = (event) => {
      this.ngZone.run(() => {
        this.messageSubject.next(JSON.parse(event.data));
      });
    };
    this.socket.onclose = () => setTimeout(() => {
      this.ngZone.run(() => this.connect());
    }, 2000);
  }

  sendCommand(deviceId: string, action: string) {
    return this.http.post('http://localhost:8080/api/command', { deviceId, payload: action });
  }

  registerDevice(deviceId: string) {
    return this.http.post('http://localhost:8080/api/devices', { deviceId });
  }

  deleteDevice(deviceId: string) {
    return this.http.post('http://localhost:8080/api/devices/delete', { deviceId });
  }
}