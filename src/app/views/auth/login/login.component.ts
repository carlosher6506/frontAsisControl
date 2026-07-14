import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize, take } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { RegisterService } from '../../../core/services/register.service';
import { LoginRequest, RegistroRequest } from '../../../core/models/auth.model';
import { GOOGLE_REDIRECT_URI, ID_CLIENT } from '../../../config/environment';

type Tab = 'login' | 'registro' | 'recuperar';

interface AuthErrorResponse {
  code?: 'AUTH_LOCKED' | 'EMAIL_NOT_VERIFIED';
  retryAfterSeconds?: number;
}

const MAX_FAILED_ATTEMPTS = 6;
const DEFAULT_LOCK_SECONDS = 15 * 60;
const GOOGLE_STATE_KEY = 'oauth.google.state';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, OnDestroy {
  tabActivo: Tab = 'login';

  loginForm: FormGroup;
  registroForm: FormGroup;
  resetForm: FormGroup;

  isLoading = false;
  isLoadingRegistro = false;
  isLoadingGoogle = false;
  solicitandoReset = false;
  enviandoVerificacion = false;

  showPassword = false;
  showPasswordRegistro = false;
  emailNoVerificado = false;
  emailParaReenvio = '';
  segundosBloqueo = 0;

  readonly maxFailedAttempts = MAX_FAILED_ATTEMPTS;
  readonly googleClientId = ID_CLIENT;

  private bloqueoTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly registerService: RegisterService,
    private readonly sweetAlert: SweetAlertService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      password: ['', [Validators.required, Validators.maxLength(256)]],
    });

    this.registroForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(256)]],
      confirmarPassword: ['', Validators.required],
    }, { validators: (control) => this.validarCoincidenciaPassword(control) });

    this.resetForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    });
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      void this.router.navigate(['/dashboard']);
      return;
    }

    this.route.queryParamMap.pipe(take(1)).subscribe((params) => {
      if (params.get('expired') === 'true') {
        this.sweetAlert.warning('Sesión expirada', 'Inicia sesión nuevamente.');
        void this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    });
  }

  ngOnDestroy(): void {
    this.detenerBloqueo();
  }

  get email() {
    return this.loginForm.get('email')!;
  }

  get password() {
    return this.loginForm.get('password')!;
  }

  get loginBloqueado(): boolean {
    return this.segundosBloqueo > 0;
  }

  cambiarTab(tab: Tab): void {
    this.tabActivo = tab;
    this.emailNoVerificado = false;
  }

  onSubmit(): void {
    if (this.isLoading || this.loginBloqueado) return;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const values = this.loginForm.getRawValue();
    const credentials: LoginRequest = {
      email: values.email.trim().toLowerCase(),
      password: values.password,
    };

    this.isLoading = true;
    this.emailNoVerificado = false;
    this.sweetAlert.loading('Iniciando sesión...', 'Verificando credenciales');

    this.authService.login(credentials).subscribe({
      next: async (response) => {
        this.sweetAlert.closeLoading();
        this.isLoading = false;
        this.loginForm.controls['password'].reset();
        this.sweetAlert.toast(`¡Bienvenido, ${response.usuario.nombre}!`, 'success');
        await this.router.navigate(['/dashboard']);
      },
      error: (error: HttpErrorResponse) => {
        this.sweetAlert.closeLoading();
        this.isLoading = false;
        this.manejarErrorLogin(error);
      },
    });
  }

  onSolicitarReset(): void {
    if (this.solicitandoReset) return;

    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    const email = this.resetForm.getRawValue().email.trim().toLowerCase();
    this.solicitandoReset = true;
    this.sweetAlert.loading('Enviando...', 'Procesando tu solicitud');

    this.authService.solicitarReset(email).subscribe({
      next: () => {
        this.solicitandoReset = false;
        this.sweetAlert.closeLoading();
        this.sweetAlert.success(
          'Solicitud recibida',
          'Si el correo existe, recibirás un enlace para restablecer tu contraseña.',
        );
        this.resetForm.reset();
        this.cambiarTab('login');
      },
      error: () => {
        this.solicitandoReset = false;
        this.sweetAlert.closeLoading();
        this.sweetAlert.error('Error', 'No fue posible procesar la solicitud. Intenta nuevamente más tarde.');
      },
    });
  }

  reenviarVerificacionLogin(): void {
    if (this.enviandoVerificacion || !this.emailParaReenvio) return;

    this.enviandoVerificacion = true;
    this.authService.reenviarVerificacion(this.emailParaReenvio)
      .pipe(finalize(() => this.enviandoVerificacion = false))
      .subscribe({
        next: () => {
          this.sweetAlert.success('Correo enviado', 'Revisa tu bandeja de entrada.');
          this.emailNoVerificado = false;
        },
        error: () => {
          this.sweetAlert.error('No fue posible reenviar el correo', 'Intenta nuevamente más tarde.');
        },
      });
  }

  onRegistro(): void {
    if (this.isLoadingRegistro) return;

    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      return;
    }

    const values = this.registroForm.getRawValue();
    const data: RegistroRequest = {
      nombre: values.nombre.trim(),
      email: values.email.trim().toLowerCase(),
      password: values.password,
    };

    this.isLoadingRegistro = true;
    this.sweetAlert.loading('Creando cuenta...', 'Un momento por favor');

    this.registerService.registro(data).subscribe({
      next: () => {
        this.isLoadingRegistro = false;
        this.sweetAlert.closeLoading();
        this.sweetAlert.success('¡Cuenta creada!', 'Revisa tu correo para verificar la cuenta.');
        this.registroForm.reset();
        this.cambiarTab('login');
      },
      error: () => {
        this.isLoadingRegistro = false;
        this.sweetAlert.closeLoading();
        this.sweetAlert.error('Error', 'No fue posible crear la cuenta. Verifica la información e inténtalo más tarde.');
      },
    });
  }

  async loginConGoogle(): Promise<void> {
    if (this.isLoadingGoogle) return;

    try {
      this.isLoadingGoogle = true;
      const state = this.generarTokenAleatorio();
      sessionStorage.setItem(GOOGLE_STATE_KEY, state);

      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id', this.googleClientId);
      url.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('state', state);
      url.searchParams.set('prompt', 'select_account');

      window.location.assign(url.toString());
    } catch {
      this.isLoadingGoogle = false;
      this.sweetAlert.error('No se pudo iniciar Google', 'Intenta nuevamente más tarde.');
    }
  }

  private manejarErrorLogin(error: HttpErrorResponse): void {
    const payload = error.error as AuthErrorResponse | null;

    if (error.status === 429 || payload?.code === 'AUTH_LOCKED') {
      this.iniciarBloqueo(payload?.retryAfterSeconds ?? DEFAULT_LOCK_SECONDS);
      this.sweetAlert.warning(
        'Acceso temporalmente limitado',
        `Alcanzaste el máximo de ${MAX_FAILED_ATTEMPTS} intentos. Intenta más tarde.`,
      );
      return;
    }

    if (payload?.code === 'EMAIL_NOT_VERIFIED') {
      this.emailNoVerificado = true;
      this.emailParaReenvio = this.loginForm.getRawValue().email.trim().toLowerCase();
      return;
    }

    this.sweetAlert.error('No se pudo iniciar sesión', 'Verifica tus credenciales e inténtalo nuevamente.');
  }

  private iniciarBloqueo(segundos: number): void {
    const duracion = Math.min(Math.max(Math.ceil(segundos), 1), 60 * 60);
    this.detenerBloqueo();
    this.segundosBloqueo = duracion;

    this.bloqueoTimer = setInterval(() => {
      this.segundosBloqueo--;
      if (this.segundosBloqueo <= 0) this.detenerBloqueo();
    }, 1000);
  }

  private detenerBloqueo(): void {
    if (this.bloqueoTimer) {
      clearInterval(this.bloqueoTimer);
      this.bloqueoTimer = undefined;
    }
    this.segundosBloqueo = 0;
  }

  private validarCoincidenciaPassword(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmacion = control.get('confirmarPassword')?.value;
    return password && confirmacion && password !== confirmacion ? { passwordMismatch: true } : null;
  }

  private generarTokenAleatorio(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}
