import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EducationLevelsService } from '../../../core/services/education-levels.service';
import { AcademicLevelsService } from '../../../core/services/academic-levels.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { NivelEducativo, CrearNivelEducativo } from '../../../core/models/education-level.model';
import { NivelAcademico, CrearNivelAcademico, ActualizarNivelAcademico } from '../../../core/models/academic-level.model';

@Component({
  selector: 'app-levels',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './levels.component.html',
  styleUrl: './levels.component.scss'
})
export class LevelsComponent implements OnInit {

  // ── Niveles Educativos ─────────────────────────────────────────
  nivelesEducativos: NivelEducativo[] = [];
  isLoadingEducativos = true;
  isSubmittingEducativo = false;
  modoEdicionEducativo = false;
  nivelEducativoSeleccionado: NivelEducativo | null = null;

  formEducativo: FormGroup;

  // ── Niveles Académicos ─────────────────────────────────────────
  nivelesAcademicos: NivelAcademico[] = [];
  isLoadingAcademicos = true;
  isSubmittingAcademico = false;
  modoEdicionAcademico = false;
  nivelAcademicoSeleccionado: NivelAcademico | null = null;

  formAcademico: FormGroup;

  tiposEstructura = [
    { value: 'grado',    label: 'Grados (1°, 2°, 3°...)' },
    { value: 'semestre', label: 'Semestres (1°, 2°, 3°...)' }
  ];

  constructor(
    private educationLevelsService: EducationLevelsService,
    private academicLevelsService: AcademicLevelsService,
    private sweetAlert: SweetAlertService,
    private fb: FormBuilder
  ) {
    this.formEducativo = this.fb.group({
      nombre:                          ['', Validators.required],
      tipo_estructura:                 ['', Validators.required],
      calificacion_minima_aprobatoria: [6, [Validators.required, Validators.min(0), Validators.max(10)]],
      forzar_minimo:                   [false]
    });

    this.formAcademico = this.fb.group({
      nivel_educativo_id: ['', Validators.required],
      nombre:             ['', Validators.required],
      orden:              ['', [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    this.cargarNivelesEducativos();
    this.cargarNivelesAcademicos();
  }

  // ── Getters Educativo ──────────────────────────────────────────
  get eNombre()      { return this.formEducativo.get('nombre')!; }
  get eTipo()        { return this.formEducativo.get('tipo_estructura')!; }
  get eCalMin()      { return this.formEducativo.get('calificacion_minima_aprobatoria')!; }

  // ── Getters Académico ──────────────────────────────────────────
  get aNivelId()  { return this.formAcademico.get('nivel_educativo_id')!; }
  get aNombre()   { return this.formAcademico.get('nombre')!; }
  get aOrden()    { return this.formAcademico.get('orden')!; }

  // ── Helper nombre nivel educativo ──────────────────────────────
  getNombreNivelEducativo(id: number): string {
    return this.nivelesEducativos.find(n => n.id === id)?.nombre || `Nivel ${id}`;
  }

  // ── Cargar ─────────────────────────────────────────────────────
  cargarNivelesEducativos(): void {
    this.isLoadingEducativos = true;
    this.educationLevelsService.obtenerNiveles().subscribe({
      next: (data) => { this.nivelesEducativos = data; this.isLoadingEducativos = false; },
      error: () => { this.sweetAlert.error('Error', 'No se pudieron cargar los niveles educativos'); this.isLoadingEducativos = false; }
    });
  }

  cargarNivelesAcademicos(): void {
    this.isLoadingAcademicos = true;
    this.academicLevelsService.obtenerNiveles().subscribe({
      next: (data) => { this.nivelesAcademicos = data; this.isLoadingAcademicos = false; },
      error: () => { this.sweetAlert.error('Error', 'No se pudieron cargar los niveles académicos'); this.isLoadingAcademicos = false; }
    });
  }

  // ── Modales Educativo ──────────────────────────────────────────
  abrirModalCrearEducativo(): void {
    this.modoEdicionEducativo = false;
    this.nivelEducativoSeleccionado = null;
    this.formEducativo.reset({ calificacion_minima_aprobatoria: 6, forzar_minimo: false });
  }

  abrirModalEditarEducativo(nivel: NivelEducativo): void {
    this.modoEdicionEducativo = true;
    this.nivelEducativoSeleccionado = nivel;
    this.formEducativo.patchValue({
      nombre:                          nivel.nombre,
      tipo_estructura:                 nivel.tipo_estructura,
      calificacion_minima_aprobatoria: nivel.calificacion_minima_aprobatoria,
      forzar_minimo:                   nivel.forzar_minimo
    });
  }

  guardarEducativo(): void {
    if (this.formEducativo.invalid) { this.formEducativo.markAllAsTouched(); return; }
    this.isSubmittingEducativo = true;

    const data: CrearNivelEducativo = this.formEducativo.value;

    if (this.modoEdicionEducativo && this.nivelEducativoSeleccionado) {
      this.educationLevelsService.actualizarNivel(this.nivelEducativoSeleccionado.id, data).subscribe({
        next: () => { this.sweetAlert.toast('Nivel educativo actualizado', 'success'); this.cerrarModalEducativo(); this.cargarNivelesEducativos(); this.isSubmittingEducativo = false; },
        error: () => { this.sweetAlert.error('Error', 'No se pudo actualizar'); this.isSubmittingEducativo = false; }
      });
    } else {
      this.educationLevelsService.crearNivel(data).subscribe({
        next: () => { this.sweetAlert.toast('Nivel educativo creado', 'success'); this.cerrarModalEducativo(); this.cargarNivelesEducativos(); this.isSubmittingEducativo = false; },
        error: () => { this.sweetAlert.error('Error', 'No se pudo crear'); this.isSubmittingEducativo = false; }
      });
    }
  }

  async eliminarEducativo(nivel: NivelEducativo): Promise<void> {
    const result = await this.sweetAlert.confirmDelete(
      `¿Eliminar "${nivel.nombre}"?`,
      'Se eliminarán también sus grados/semestres y grupos asociados'
    );
    if (result.isConfirmed) {
      this.educationLevelsService.eliminarNivel(nivel.id).subscribe({
        next: () => { this.sweetAlert.toast('Nivel eliminado', 'success'); this.cargarNivelesEducativos(); this.cargarNivelesAcademicos(); },
        error: () => this.sweetAlert.error('Error', 'No se pudo eliminar')
      });
    }
  }

  cerrarModalEducativo(): void {
    this.formEducativo.reset({ calificacion_minima_aprobatoria: 6, forzar_minimo: false });
    this.modoEdicionEducativo = false;
    this.nivelEducativoSeleccionado = null;
    const modal = document.getElementById('modalEducativo');
    if (modal) (window as any).bootstrap.Modal.getInstance(modal)?.hide();
  }

  // ── Modales Académico ──────────────────────────────────────────
  abrirModalCrearAcademico(): void {
    this.modoEdicionAcademico = false;
    this.nivelAcademicoSeleccionado = null;
    this.formAcademico.reset();
  }

  abrirModalEditarAcademico(nivel: NivelAcademico): void {
     console.log('Nivel a editar:', nivel); // ← agrega esto
    this.modoEdicionAcademico = true;
    this.nivelAcademicoSeleccionado = nivel;
    this.formAcademico.patchValue({
      nivel_educativo_id: nivel.nivel_educativo_id, // ← debe ser editable
      nombre:             nivel.nombre,
      orden:              nivel.orden
    });
  }

  guardarAcademico(): void {
    if (this.formAcademico.invalid) {
      this.formAcademico.markAllAsTouched();
      return;
    }

    this.isSubmittingAcademico = true;

    const data = {
      nivel_educativo_id: Number(this.formAcademico.value.nivel_educativo_id),
      nombre:             this.formAcademico.value.nombre,
      orden:              Number(this.formAcademico.value.orden)
    };

    console.log('modoEdicion:', this.modoEdicionAcademico);
    console.log('Datos a enviar:', data);

    if (this.modoEdicionAcademico && this.nivelAcademicoSeleccionado) {
      this.academicLevelsService.actualizarNivel(this.nivelAcademicoSeleccionado.id, data).subscribe({
        next: () => {
          this.sweetAlert.toast('Grado/Semestre actualizado', 'success');
          this.cerrarModalAcademico();
          this.cargarNivelesAcademicos();
          this.isSubmittingAcademico = false;
        },
        error: (err) => {
          this.sweetAlert.error('Error', err.error?.message || 'No se pudo actualizar');
          this.isSubmittingAcademico = false;
        }
      });
    } else {
      this.academicLevelsService.crearNivel(data).subscribe({
        next: () => {
          this.sweetAlert.toast('Grado/Semestre creado', 'success');
          this.cerrarModalAcademico();
          this.cargarNivelesAcademicos();
          this.isSubmittingAcademico = false;
        },
        error: (err) => {
          this.sweetAlert.error('Error', err.error?.message || 'No se pudo crear');
          this.isSubmittingAcademico = false;
        }
      });
    }
  }


  async eliminarAcademico(nivel: NivelAcademico): Promise<void> {
    const result = await this.sweetAlert.confirmDelete(
      `¿Eliminar "${nivel.nombre}"?`,
      'Se eliminarán también los grupos asociados'
    );
    if (result.isConfirmed) {
      this.academicLevelsService.eliminarNivel(nivel.id).subscribe({
        next: () => { this.sweetAlert.toast('Grado/Semestre eliminado', 'success'); this.cargarNivelesAcademicos(); },
        error: () => this.sweetAlert.error('Error', 'No se pudo eliminar')
      });
    }
  }

  cerrarModalAcademico(): void {
    this.formAcademico.reset();
    this.modoEdicionAcademico = false;
    this.nivelAcademicoSeleccionado = null;
    const modal = document.getElementById('modalAcademico');
    if (modal) (window as any).bootstrap.Modal.getInstance(modal)?.hide();
  }
}
