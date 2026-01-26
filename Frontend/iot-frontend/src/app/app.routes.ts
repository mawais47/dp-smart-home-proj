import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';

export const routes: Routes = [
  {
    path: '', // The default path (http://localhost:4200)
    component: DashboardComponent,
  },
  {
    path: '**', // Redirect any unknown paths back to the dashboard
    redirectTo: '',
  }
];