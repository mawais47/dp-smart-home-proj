import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  username = '';
  password = '';
  role: 'user' | 'admin' = 'user';
  error = signal('');
  loading = signal(false);

  constructor(private auth: AuthService, private router: Router) {}

  setRole(role: 'user' | 'admin') {
    this.role = role;
    this.error.set('');
  }

  submit() {
    const username = this.username.trim();
    const password = this.password.trim();

    if (!username || !password) {
      this.error.set('Username and password are required.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.auth.login({ username, password, role: this.role }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 0) {
          this.error.set('Cannot reach the backend. Make sure it is running on port 8080.');
          return;
        }
        if (err.status === 404) {
          this.error.set('Login API not found. Restart the backend with the latest code (go run .).');
          return;
        }
        this.error.set(err.error?.error || 'Login failed. Check your credentials.');
      }
    });
  }
}
