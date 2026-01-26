import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Add this for [(ngModel)]
import { IotService } from '../../services/iot.service';
import { DeviceMessage } from '../../models/device.model';

@Component({
  selector: 'app-chat-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-view.component.html',
  styleUrls: ['./chat-view.component.scss']
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