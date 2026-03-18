import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { LoginRequest } from '../../../core/models/auth.model';

@Component({
  selector: 'app-login',
  imports: [CommonModule,ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {


  loginForm: FormGroup;
  isLoading = false;
  showPassword = false;


  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private sweetAlert: SweetAlertService,
    private router: Router
  ){
    if(this.authService.isAuthenticated()){
      this.router.navigate(['/dashboard']);
    }
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }


  // ------ Geters ------

  get email() { return this.loginForm.get('email')!; }
  get password() { return this.loginForm.get('password')!; }


  // ------ Mostrar/ocultar contrasena ------

  togglePassword(): void{
    this.showPassword = !this.showPassword;
  }


  // ------ Submit ------

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.sweetAlert.warning(
        'Formulario incompleto',
        'Por favor completa todos los campos correctamente'
      );
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
        this.sweetAlert.error(
          'Error al iniciar sesión',
          err.error?.message || 'Correo o contraseña incorrectos'
        );
      }
    });
  }
}
