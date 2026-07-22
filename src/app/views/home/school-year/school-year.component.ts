import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SchoolYearService } from '../../../core/services/school-year.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { CicloEscolar, CrearCiclo, ActualizarCiclo } from '../../../core/models/school-year.model';

@Component({
  selector: 'app-school-year',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './school-year.component.html',
  styleUrl: './school-year.component.scss'
})
export class SchoolYearComponent implements OnInit {

  ciclos: CicloEscolar[] = [];
  isLoading = true;
  isSubmitting = false;
  modoEdicion = false;
  cicloSeleccionado: CicloEscolar | null = null;

  form: FormGroup;

  constructor(
    private schoolYearService: SchoolYearService,
    private sweetAlert: SweetAlertService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      nombre:       ['', Validators.required],
      fecha_inicio: ['', Validators.required],
      fecha_fin:    ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.cargarCiclos();
  }

  // ── Getters ────────────────────────────────────────────────────
  get nombre()       { return this.form.get('nombre')!; }
  get fecha_inicio() { return this.form.get('fecha_inicio')!; }
  get fecha_fin()    { return this.form.get('fecha_fin')!; }

  // ── Cargar ─────────────────────────────────────────────────────
  cargarCiclos(): void {
    this.isLoading = true;
    this.schoolYearService.obtenerCiclos().subscribe({
      next: (data) => { this.ciclos = data; this.isLoading = false; },
      error: () => { this.sweetAlert.error('Error', 'No se pudieron cargar los ciclos'); this.isLoading = false; }
    });
  }

  // ── Abrir modal crear ──────────────────────────────────────────
  abrirModalCrear(): void {
    this.modoEdicion = false;
    this.cicloSeleccionado = null;
    this.form.reset();
  }

  // ── Abrir modal editar ─────────────────────────────────────────
  abrirModalEditar(ciclo: CicloEscolar): void {
    this.modoEdicion = true;
    this.cicloSeleccionado = ciclo;
    this.form.patchValue({
      nombre:       ciclo.nombre,
      fecha_inicio: ciclo.fecha_inicio?.substring(0, 10),
      fecha_fin:    ciclo.fecha_fin?.substring(0, 10)
    });
  }

  // ── Guardar ────────────────────────────────────────────────────
  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;

    if (this.modoEdicion && this.cicloSeleccionado) {
      const data: ActualizarCiclo = this.form.value;
      this.schoolYearService.actualizarCiclo(this.cicloSeleccionado.id, data).subscribe({
        next: () => { this.sweetAlert.toast('Ciclo actualizado', 'success'); this.cerrarModal(); this.cargarCiclos(); this.isSubmitting = false; },
        error: () => { this.sweetAlert.error('Error', 'No se pudo actualizar'); this.isSubmitting = false; }
      });
    } else {
      const data: CrearCiclo = this.form.value;
      this.schoolYearService.crearCiclo(data).subscribe({
        next: () => { this.sweetAlert.toast('Ciclo creado', 'success'); this.cerrarModal(); this.cargarCiclos(); this.isSubmitting = false; },
        error: () => { this.sweetAlert.error('Error', 'No se pudo crear el ciclo'); this.isSubmitting = false; }
      });
    }
  }

  // ── Activar ciclo ──────────────────────────────────────────────
  async activar(ciclo: CicloEscolar): Promise<void> {
    if (ciclo.activo) return;

    const result = await this.sweetAlert.confirm(
      `¿Activar el ciclo ${ciclo.nombre}?`,
      'Se desactivará el ciclo actual activo'
    );

    if (result.isConfirmed) {
      this.schoolYearService.activarCiclo(ciclo.id).subscribe({
        next: () => { this.sweetAlert.toast(`Ciclo ${ciclo.nombre} activado`, 'success'); this.cargarCiclos(); },
        error: () => this.sweetAlert.error('Error', 'No se pudo activar el ciclo')
      });
    }
  }

  // ── Eliminar ───────────────────────────────────────────────────
  async eliminar(ciclo: CicloEscolar): Promise<void> {
    if (ciclo.activo) {
      this.sweetAlert.warning('No permitido', 'No puedes eliminar el ciclo activo');
      return;
    }
    const result = await this.sweetAlert.confirmDelete(
      `¿Eliminar el ciclo ${ciclo.nombre}?`,
      'Se eliminarán todos los grupos asociados'
    );
    if (result.isConfirmed) {
      this.schoolYearService.eliminarCiclo(ciclo.id).subscribe({
        next: () => { this.sweetAlert.toast('Ciclo eliminado', 'success'); this.cargarCiclos(); },
        error: () => this.sweetAlert.error('Error', 'No se pudo eliminar el ciclo')
      });
    }
  }

  // ── Cerrar modal ───────────────────────────────────────────────
  cerrarModal(): void {
    this.form.reset();
    this.modoEdicion = false;
    this.cicloSeleccionado = null;
    const modal = document.getElementById('modalCiclo');
    if (modal) (window as any).bootstrap.Modal.getInstance(modal)?.hide();
  }

  // ── Formato fecha ──────────────────────────────────────────────
  formatearFecha(fecha: string): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }
}
