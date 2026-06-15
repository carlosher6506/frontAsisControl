import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})

export class ResetPasswordComponent implements OnInit {

  form: FormGroup;
  estado: 'formulario' | 'exitoso' | 'error' = 'formulario';
  mensajeError = '';
  isLoading = false;
  showPassword = false;
  token = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {
    this.form = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmar: ['', Validators.required]
    }, { validators: this.passwordsCoinciden });
  }

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.estado = 'error';
      this.mensajeError = 'Token no encontrado en el enlace.';
      return;
    }
    this.token = token;
  }

  passwordsCoinciden(group: FormGroup) {
    const pass = group.get('password')?.value;
    const confirmar = group.get('confirmar')?.value;
    return pass === confirmar ? null : { noCoinciden: true };
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isLoading = true;

    this.authService.resetPassword(this.token, this.form.value.password).subscribe({
      next: () => { this.estado = 'exitoso'; },
      error: (err: any) => {
        this.isLoading = false;
        this.estado = 'error';
        this.mensajeError = err.error?.message || 'No se pudo actualizar la contraseña.';
      }
    });
  }
}
