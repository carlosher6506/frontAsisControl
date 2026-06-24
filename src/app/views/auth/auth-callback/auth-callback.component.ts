import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service'
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth-callback.component.html'
})
export class AuthCallbackComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');

    if (!code) {
      this.sweetAlert.error('Error', 'No se recibió código de Google');
      this.router.navigate(['/login']);
      return;
    }

    this.authService.loginConGoogleCode(code).subscribe({
      next: (res) => {
        this.sweetAlert.toast(`¡Bienvenido, ${res.usuario.nombre}!`, 'success');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.sweetAlert.error('Error', err.error?.message || 'No se pudo autenticar con Google');
        this.router.navigate(['/login']);
      }
    });
  }
}
