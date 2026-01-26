import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IotService } from './services/iot.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('iot-frontend');

  constructor(_iot: IotService) {
    // Eagerly create IotService so WebSocket connects at app boot.
  }
}
