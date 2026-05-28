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

  resultadoCalificacion: any = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private registerService: RegisterService,
    private sweetAlert: SweetAlertService,
    private router: Router,
    private route: ActivatedRoute
  ) {
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
    })
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['expired']) {
        this.sweetAlert.warning('Sesión expirada', 'Tu sesión ha expirado. Inicia sesión nuevamente.');
      }
    });
  }

  get email()    { return this.loginForm.get('email')!; }
  get password() { return this.loginForm.get('password')!; }

  cambiarTab(tab: Tab): void {
    this.tabActivo = tab;
    this.resultadoCalificacion = null;
  }

  togglePassword(): void { this.showPassword = !this.showPassword; }
  togglePasswordRegistro(): void { this.showPasswordRegistro = !this.showPasswordRegistro; }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.isLoading = true;
    this.sweetAlert.loading('Iniciando sesión...', 'Verificando credenciales');

    const credentials: LoginRequest = this.loginForm.value;
    this.authService.login(credentials).subscribe({
      next: (response) => {
        this.sweetAlert.closeLoading();
        this.sweetAlert.toast(`¡Bienvenido, ${response.usuario.nombre}!`, 'success');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        this.sweetAlert.closeLoading();
        this.sweetAlert.error('Error al iniciar sesión', err.error?.message || 'Correo o contraseña incorrectos');
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
