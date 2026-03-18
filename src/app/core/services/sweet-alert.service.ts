import { Injectable } from '@angular/core';
import Swal, { SweetAlertResult } from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class SweetAlertService {

  // ─── Colores base del sistema ───────────────────────────────────────────────
  private primaryColor   = '#1a3a5c';
  private confirmColor   = '#2980b9';
  private dangerColor    = '#e74c3c';
  private warningColor   = '#f39c12';
  private successColor   = '#27ae60';

  // ─── ÉXITO ──────────────────────────────────────────────────────────────────

  success(title: string, message: string = ''): void {
    Swal.fire({
      icon: 'success',
      title,
      text: message,
      confirmButtonColor: this.confirmColor,
      confirmButtonText: 'Aceptar',
      timer: 3000,
      timerProgressBar: true,
    });
  }

  // ─── ERROR ───────────────────────────────────────────────────────────────────

  error(title: string, message: string = ''): void {
    Swal.fire({
      icon: 'error',
      title,
      text: message,
      confirmButtonColor: this.dangerColor,
      confirmButtonText: 'Entendido',
    });
  }

  // ─── ADVERTENCIA ─────────────────────────────────────────────────────────────

  warning(title: string, message: string = ''): void {
    Swal.fire({
      icon: 'warning',
      title,
      text: message,
      confirmButtonColor: this.warningColor,
      confirmButtonText: 'Aceptar',
    });
  }

  // ─── INFORMACIÓN ─────────────────────────────────────────────────────────────

  info(title: string, message: string = ''): void {
    Swal.fire({
      icon: 'info',
      title,
      text: message,
      confirmButtonColor: this.primaryColor,
      confirmButtonText: 'Aceptar',
    });
  }

  // ─── CONFIRMACIÓN (Sí / No) ───────────────────────────────────────────────────

  confirm(
    title: string,
    message: string = '¿Estás seguro de realizar esta acción?',
    confirmText: string = 'Sí, continuar',
    cancelText: string = 'Cancelar'
  ): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'question',
      title,
      text: message,
      showCancelButton: true,
      confirmButtonColor: this.confirmColor,
      cancelButtonColor: this.dangerColor,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      reverseButtons: true,
    });
  }

  // ─── CONFIRMAR ELIMINACIÓN ────────────────────────────────────────────────────

  confirmDelete(
    title: string = '¿Eliminar registro?',
    message: string = 'Esta acción no se puede deshacer'
  ): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'warning',
      title,
      text: message,
      showCancelButton: true,
      confirmButtonColor: this.dangerColor,
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    });
  }

  // ─── LOADING (mostrar / ocultar) ──────────────────────────────────────────────

  loading(title: string = 'Cargando...', message: string = 'Por favor espera'): void {
    Swal.fire({
      title,
      text: message,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });
  }

  closeLoading(): void {
    Swal.close();
  }

  // ─── TOAST (notificación esquina) ─────────────────────────────────────────────

  toast(
    title: string,
    icon: 'success' | 'error' | 'warning' | 'info' = 'success',
    position: 'top-end' | 'top' | 'bottom-end' | 'bottom' = 'top-end'
  ): void {
    Swal.fire({
      toast: true,
      position,
      icon,
      title,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
  }
}
