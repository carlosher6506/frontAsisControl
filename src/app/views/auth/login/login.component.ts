import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { ActivatedRoute } from '@angular/router'
import { RegisterService } from '../../../core/services/register.service';
import { ID_CLIENT } from '../../../config/environment'

type Tab = 'login' | 'registro' | 'calificaciones' | 'recuperar';

declare const google: any;

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {

  tabActivo: Tab = 'login';

  loginForm: FormGroup;
  registroForm: FormGroup;
  calificacionForm: FormGroup;
  recuperarForm: FormGroup;

  isLoading = false;
  isLoadingRegistro = false;
  isLoadingCalificacion = false;
  showPassword = false;
  showPasswordRegistro = false;

  emailNoVerificado = false;
  emailParaReenvio = '';
  enviandoVerificacion = false;
  solicitandoReset = false;

  resultadoCalificacion: any = null;

  resetForm!: FormGroup;

  googleClientId = ID_CLIENT;
  isLoadingGoogle = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private registerService: RegisterService,
    private sweetAlert: SweetAlertService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.resetForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }

    this.loginForm = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.registroForm = this.fb.group({
      nombre:   ['', [Validators.required, Validators.minLength(3)]],
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmarPassword: ['', Validators.required]
    });

    this.calificacionForm = this.fb.group({
      matricula: ['', Validators.required]
    });

    this.recuperarForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['expired']) {
        this.sweetAlert.warning(
          'Sesión expirada',
          'Tu sesión ha expirado. Inicia sesión nuevamente.'
        );
      }
    });

    if (typeof google !== 'undefined') {
      google.accounts.id.initialize({
        client_id: this.googleClientId,
        callback: (response: any) => this.handleGoogleResponse(response),
        auto_select: false,
        cancel_on_tap_outside: true,
      });
    }
  }

  get email()    {
    return this.loginForm.get('email')!;
  }

  get password() {
    return this.loginForm.get('password')!;
  }

  cambiarTab(tab: Tab): void {
    this.tabActivo = tab;
    this.resultadoCalificacion = null;
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  togglePasswordRegistro(): void {
    this.showPasswordRegistro = !this.showPasswordRegistro;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.isLoading = true;
    this.emailNoVerificado = false;
    this.sweetAlert.loading('Iniciando sesión...', 'Verificando credenciales');

    this.authService.login(this.loginForm.value).subscribe({
      next: (response) => {
        this.sweetAlert.closeLoading();
        this.sweetAlert.toast(`¡Bienvenido, ${response.usuario.nombre}!`, 'success');
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        this.isLoading = false;
        this.sweetAlert.closeLoading();
        if (err.error?.code === 'EMAIL_NOT_VERIFIED') {
          this.emailNoVerificado = true;
          this.emailParaReenvio = this.loginForm.value.email;
        } else {
          this.sweetAlert.error('Error', err.error?.message || 'Correo o contraseña incorrectos');
        }
      }
    });
  }

  onSolicitarReset(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }
    this.solicitandoReset = true;

    this.authService.solicitarReset(this.resetForm.value.email).subscribe({
      next: () => {
        this.solicitandoReset = false;
        this.sweetAlert.success(
          'Correo enviado',
          'Si el correo existe, recibirás un enlace para restablecer tu contraseña.'
        );
        this.resetForm.reset();
        this.tabActivo = 'login';
      },
      error: (err: any) => {
        this.solicitandoReset = false;
        this.sweetAlert.error('Error', err.error?.message || 'No se pudo procesar la solicitud');
      }
    });
  }

  reenviarVerificacionLogin(): void {
    this.enviandoVerificacion = true;
    this.authService.reenviarVerificacion(this.emailParaReenvio).subscribe({
      next: () => {
        this.enviandoVerificacion = false;
        this.sweetAlert.success('Correo enviado', 'Revisa tu bandeja de entrada.');
        this.emailNoVerificado = false;
      },
      error: (err: any) => {
        this.enviandoVerificacion = false;
        this.sweetAlert.error('Error', err.error?.message || 'No se pudo reenviar');
      }
    });
  }

  onRegistro(): void {
    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      return;
    }
    this.isLoadingRegistro = true;
    this.registerService.registro(this.registroForm.value).subscribe({
      next: () => {
        this.sweetAlert.success('¡Cuenta creada!', 'Ya puedes iniciar sesión con tus credenciales');
        this.registroForm.reset();
        this.tabActivo = 'login';
        this.isLoadingRegistro = false;
      },
      error: (err) => {
        this.sweetAlert.error('Error', err.error?.message || 'No se pudo crear la cuenta');
        this.isLoadingRegistro = false;
      }
    });
  }

  onConsultarCalificacion(): void {
    if (this.calificacionForm.invalid) {
      this.calificacionForm.markAllAsTouched();
      return;
    }
    this.isLoadingCalificacion = true;
    this.resultadoCalificacion = null;

    const matricula = this.calificacionForm.value.matricula;
    this.registerService.consultarCalificaciones(matricula).subscribe({
      next: (data) => {
        this.resultadoCalificacion = data;
        this.isLoadingCalificacion = false;
      },
      error: (err) => {
        this.sweetAlert.error('No encontrado', err.error?.message || 'Matrícula no encontrada');
        this.isLoadingCalificacion = false;
      }
    });
  }

  // https://front-asis-control-3k4t.vercel.app
  // Nuevos métodos
  loginConGoogle(): void {
    //const clientId = this.googleClientId;
    const clientId = '218667265692-vuiapu3a4mlq69sublje0psss4kh4eq3.apps.googleusercontent.com';
    const redirectUri = encodeURIComponent('https://front-asis-control-3k4t.vercel.app/auth/callback');
    const scope = encodeURIComponent('openid email profile');

    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;

    window.location.href = url;
  }

  handleGoogleResponse(response: any): void {
    this.isLoadingGoogle = true;
    this.sweetAlert.loading('Iniciando sesión...', 'Verificando con Google');

    this.authService.loginConGoogle(response.credential).subscribe({
      next: (res) => {
        this.isLoadingGoogle = false;
        this.sweetAlert.closeLoading();
        this.sweetAlert.toast(`¡Bienvenido, ${res.usuario.nombre}!`, 'success');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoadingGoogle = false;
        this.sweetAlert.closeLoading();
        this.sweetAlert.error('Error', err.error?.message || 'No se pudo autenticar con Google');
      }
    });
  }
}
