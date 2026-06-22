import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IotService } from '../../services/iot.service';

@Component({
  selector: 'app-device-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding: 10px;">
      <h3>Active Devices</h3>
      <ul>
        <li *ngFor="let dev of devices" style="color: green;">● {{ dev }}</li>
      </ul>
    </div>
  `
})
export class DeviceListComponent implements OnInit {
  devices = new Set<string>();
  constructor(private iotService: IotService) {}
  ngOnInit() {
    this.iotService.messages$.subscribe(m => {
      if(m.topic.includes('status')) this.devices.add(m.topic.split('/')[2]);
    });
  }
}