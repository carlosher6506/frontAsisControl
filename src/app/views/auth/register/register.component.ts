import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { RegisterService } from '../../../core/services/register.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {

  form: FormGroup;
  isLoading = false;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private registerService: RegisterService,
    private sweetAlert: SweetAlertService,
    private router: Router
  ) {
    this.form = this.fb.group({
      nombre:           ['', [Validators.required, Validators.minLength(3)]],
      email:            ['', [Validators.required, Validators.email]],
      password:         ['', [Validators.required, Validators.minLength(6)]],
      confirmar:        ['', Validators.required]
    }, { validators: this.passwordsIguales });
  }

  passwordsIguales(group: FormGroup) {
    const pass = group.get('password')?.value;
    const confirmar = group.get('confirmar')?.value;
    return pass === confirmar ? null : { noCoinciden: true };
  }

  get nombre()    { return this.form.get('nombre')!; }
  get email()     { return this.form.get('email')!; }
  get password()  { return this.form.get('password')!; }
  get confirmar() { return this.form.get('confirmar')!; }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.isLoading = true;
    this.sweetAlert.loading('Creando cuenta...', 'Por favor espera');

    this.registerService.registro({
      nombre:   this.form.value.nombre,
      email:    this.form.value.email,
      password: this.form.value.password
    }).subscribe({
      next: () => {
        this.sweetAlert.closeLoading();
        this.sweetAlert.success(
          '¡Cuenta creada!',
          'Tu cuenta fue creada como Maestro. Ya puedes iniciar sesión.'
        );
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.sweetAlert.closeLoading();
        this.sweetAlert.error('Error', err.error?.message || 'No se pudo crear la cuenta');
        this.isLoading = false;
      }
    });
  }
}
