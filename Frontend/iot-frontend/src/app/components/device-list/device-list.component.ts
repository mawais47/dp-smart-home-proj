import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IotService } from '../../services/iot.service';

@Component({
  selector: 'app-device-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './device-list.component.html',
  styleUrls: ['./device-list.component.scss']
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