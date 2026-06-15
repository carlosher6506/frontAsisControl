import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-verify-email',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss',
})

export class VerifyEmailComponent implements OnInit {

  estado: 'cargando' | 'exitoso' | 'error' = 'cargando';
  mensajeError = '';
  emailReenvio = '';
  enviando = false;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.estado = 'error';
      this.mensajeError = 'No se encontró el token de verificación.';
      return;
    }

    this.authService.verificarEmail(token).subscribe({
      next: () => { this.estado = 'exitoso'; },
      error: (err: any) => {
        this.estado = 'error';
        this.mensajeError = err.error?.message || 'El enlace es inválido o ha expirado.';
      }
    });
  }

  reenviarVerificacion(): void {
    if (!this.emailReenvio) return;
    this.enviando = true;
    this.authService.reenviarVerificacion(this.emailReenvio).subscribe({
      next: () => {
        this.enviando = false;
        this.mensajeError = '¡Correo reenviado! Revisa tu bandeja de entrada.';
      },
      error: (err: any) => {
        this.enviando = false;
        this.mensajeError = err.error?.message || 'No se pudo reenviar el correo.';
      }
    });
  }
}
