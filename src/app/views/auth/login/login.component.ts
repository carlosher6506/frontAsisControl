import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { LoginRequest } from '../../../core/models/auth.model';
import { ActivatedRoute } from '@angular/router'
import { RegisterService } from '../../../core/services/register.service';

type Tab = 'login' | 'registro' | 'calificaciones' | 'recuperar';


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
        this.sweetAlert.warning('Sesión expirada', 'Tu sesión ha expirado. Inicia sesión nuevamente.');
      }
    });
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
}
