import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Add this for [(ngModel)]
import { IotService } from '../../services/iot.service';
import { DeviceMessage } from '../../models/device.model';

@Component({
  selector: 'app-chat-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chat-container">
      <div class="header">
        <h2>Live Messaging Terminal</h2>
        <div class="controls">
          <input [(ngModel)]="targetId" placeholder="Device ID (e.g. fan_01)">
          <button class="btn-on" (click)="send('ON')">SEND ON</button>
          <button class="btn-off" (click)="send('OFF')">SEND OFF</button>
        </div>
      </div>

      <div class="message-list">
        <div *ngFor="let msg of logs" class="msg-bubble">
          <div class="msg-header">
            <span class="device-name">{{ msg.topic }}</span>
            <span class="time">{{ msg.timestamp | date:'HH:mm:ss' }}</span>
          </div>
          <div class="msg-body">{{ msg.payload }}</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chat-container { display: flex; flex-direction: column; height: 100%; background: #f4f7f6; }
    .header { padding: 20px; background: white; border-bottom: 1px solid #ddd; }
    .controls { display: flex; gap: 10px; margin-top: 10px; }
    .message-list { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column-reverse; }
    .msg-bubble { 
      background: white; padding: 12px; border-radius: 8px; margin-bottom: 10px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05); border-left: 4px solid #007bff;
    }
    .msg-header { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px; }
    .device-name { font-weight: bold; color: #555; }
    .time { color: #999; }
    .btn-on { background: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; }
    .btn-off { background: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; }
    input { padding: 8px; border: 1px solid #ddd; border-radius: 4px; flex: 1; }
  `]
})
export class ChatViewComponent implements OnInit {
  logs: DeviceMessage[] = [];
  targetId: string = 'sensor01'; // Default device to control

  constructor(private iotService: IotService) {}

  ngOnInit() {
    this.iotService.messages$.subscribe(m => {
      this.logs.unshift(m); // Newest messages at the top
    });
  }

  send(command: string) {
    this.iotService.sendCommand(this.targetId, command).subscribe({
      next: () => console.log(`Command ${command} sent to ${this.targetId}`),
      error: (err) => console.error("Failed to send command", err)
    });
  }
}