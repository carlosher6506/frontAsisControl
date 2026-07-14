import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
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
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmar: ['', Validators.required]
    }, { validators: (c: AbstractControl): ValidationErrors | null => {
      const pass = c.get('password')?.value;
      const confirmar = c.get('confirmar')?.value;
      return pass === confirmar ? null : { noCoinciden: true };
    }});
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

  onSubmit(): void {
    if (this.form.invalid || this.isLoading) {
      this.form.markAllAsTouched();
      return;
    }
    this.isLoading = true;

    this.authService.resetPassword(this.token, this.form.value.password).subscribe({
      next: () => {
        this.isLoading = false; // ← faltaba
        this.estado = 'exitoso';
      },
      error: (err: any) => {
        this.isLoading = false;
        this.estado = 'error';
        this.mensajeError = err.error?.message || 'No se pudo actualizar la contraseña.';
      }
    });
  }
}
