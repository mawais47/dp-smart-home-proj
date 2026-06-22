import { Component } from '@angular/core';
import { DashboardComponent } from './components/dashboard/dashboard.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DashboardComponent], // This tells Angular to use our dashboard
  template: `<app-dashboard></app-dashboard>` // This displays it
})
export class AppComponent {}