import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service'
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { CommonModule } from '@angular/common';

const GOOGLE_STATE_KEY = 'oauth.google.state';

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
    const params = this.route.snapshot.queryParamMap;
    const code = params.get('code');
    const state = params.get('state');
    const expectedState = sessionStorage.getItem(GOOGLE_STATE_KEY);

    if (!code || !state || !expectedState || state !== expectedState) {
      sessionStorage.removeItem(GOOGLE_STATE_KEY);
      this.sweetAlert.error('Error', 'No se pudo validar la respuesta de Google');
      this.router.navigate(['/login']);
      return;
    }

    sessionStorage.removeItem(GOOGLE_STATE_KEY);

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
