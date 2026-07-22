import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { TasksService } from '../../../core/services/tasks.service';
import { GrupoMateriasService } from '../../../core/services/grupo-materias.service';
import { GroupsService } from '../../../core/services/groups.service';
import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { EvaluationsService } from '../../../core/services/evaluations.service';
import { EtiquetasService } from '../../../core/services/etiquetas.service';
import { Tarea, CrearTarea } from '../../../core/models/task.model';
import { GrupoMateria } from '../../../core/models/groupSubject.model';
import { Grupo } from '../../../core/models/group.model';
import { ConfiguracionEvaluacion } from '../../../core/models/evaluation.model';
import { Etiqueta } from '../../../core/models/label.model';
import { Usuario } from '../../../core/models/user.model';

@Component({
  selector: 'app-tasks',
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss'
})
export class TasksComponent implements OnInit {

  tareas: Tarea[] = [];
  grupoMaterias: GrupoMateria[] = [];
  grupos: Grupo[] = [];
  evaluaciones: ConfiguracionEvaluacion[] = [];
  etiquetas: Etiqueta[] = [];
  usuario: Usuario | null = null;

  isLoading = true;
  isSubmitting = false;
  tareaEditando: Tarea | null = null;

  grupoSeleccionado: number | null = null;
  grupoMateriaSeleccionado: GrupoMateria | null = null;
  periodoSeleccionado: number = 1;
  textoBusqueda = '';

  form: FormGroup;

  constructor(
    private tasksService: TasksService,
    private grupoMateriasService: GrupoMateriasService,
    private groupsService: GroupsService,
    private evaluationsService: EvaluationsService,
    private etiquetasService: EtiquetasService,
    private authService: AuthService,
    private sweetAlert: SweetAlertService,
    private fb: FormBuilder
  ) {
    this.usuario = this.authService.getUsuario();
    this.form = this.fb.group({
      nombre:      ['', Validators.required],
      fecha:       [''],
      etiqueta_id: [''],
      valor_propio: [null]
    });
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  // ── Getters ────────────────────────────────────────────────────
  get esAdmin(): boolean {
    return this.usuario?.rol?.toLowerCase() === 'admin';
  }

  get esPorPuntos(): boolean {
    return this.configEvaluacion?.tipo_evaluacion === 'puntos';
  }

  get gruposFiltrados(): Grupo[] {
    if (this.esAdmin) return this.grupos;
    return this.grupos.filter(g => g.maestro_id === this.usuario?.id);
  }

  get materiasFiltradas(): GrupoMateria[] {
    if (!this.grupoSeleccionado) return [];
    return this.grupoMaterias.filter(gm => gm.grupo_id === Number(this.grupoSeleccionado));
  }

  get configEvaluacion(): ConfiguracionEvaluacion | null {
    if (!this.grupoSeleccionado) return null;
    return this.evaluaciones.find(e => e.grupo_id === Number(this.grupoSeleccionado)) || null;
  }

  get periodos(): number[] {
    if (!this.configEvaluacion) return [1];
    return Array.from({ length: this.configEvaluacion.num_periodos }, (_, i) => i + 1);
  }

  get nombrePeriodo(): string {
    return this.configEvaluacion?.tipo_periodo === 'trimestre' ? 'Trimestre' : 'Parcial';
  }

  get etiquetasFiltradas(): Etiqueta[] {
    if (!this.configEvaluacion) return [];
    return this.etiquetas.filter(e => e.configuracion_id === this.configEvaluacion!.id);
  }

  get tareasFiltradas(): Tarea[] {
    if (!this.grupoMateriaSeleccionado) return [];
    return this.tareas.filter(t =>
      t.grupo_materia_id === this.grupoMateriaSeleccionado!.id &&
      t.periodo === this.periodoSeleccionado &&
      (!this.textoBusqueda || t.nombre.toLowerCase().includes(this.textoBusqueda.toLowerCase()))
    );
  }

  // ── Cargar ─────────────────────────────────────────────────────
  cargarDatos(): void {
    this.isLoading = true;

    // Guarda selecciones actuales
    const grupoId = this.grupoSeleccionado;
    const grupoMateriaId = this.grupoMateriaSeleccionado?.id;
    const periodo = this.periodoSeleccionado;

    this.groupsService.obtenerGrupos().subscribe({
      next: (data) => this.grupos = data
    });

    this.grupoMateriasService.obtenerGrupoMaterias().subscribe({
      next: (data) => {
        this.grupoMaterias = this.esAdmin
          ? data
          : data.filter(gm => gm.maestro_id === this.usuario?.id);

        // Restaura la materia seleccionada
        if (grupoMateriaId) {
          this.grupoMateriaSeleccionado = this.grupoMaterias.find(gm => gm.id === grupoMateriaId) || null;
        }
      }
    });

    this.evaluationsService.obtenerEvaluaciones().subscribe({
      next: (data) => this.evaluaciones = data
    });

    this.etiquetasService.obtenerEtiquetas().subscribe({
      next: (data) => this.etiquetas = data
    });

    this.tasksService.obtenerTareas().subscribe({
      next: (data) => {
        this.tareas = data;
        this.isLoading = false;
        // Restaura las selecciones
        this.grupoSeleccionado = grupoId;
        this.periodoSeleccionado = periodo;
      },
      error: () => {
        this.sweetAlert.error('Error', 'No se pudieron cargar las tareas');
        this.isLoading = false;
      }
    });
  }

  // ── Helpers ────────────────────────────────────────────────────
  getNombreCompletoGrupo(grupo: Grupo): string {
    return `${grupo.nivel_educativo || ''} ${grupo.nivel_academico || ''} ${grupo.nombre}`.trim();
  }

  // ── Cambios en selects ─────────────────────────────────────────
  onGrupoChange(): void {
    this.grupoMateriaSeleccionado = null;
    this.periodoSeleccionado = 1;
    this.tareaEditando = null;
    this.form.reset();
  }

  seleccionarMateria(gm: GrupoMateria): void {
    this.grupoMateriaSeleccionado = gm;
    this.periodoSeleccionado = 1;
    this.tareaEditando = null;
    this.form.reset();
  }

  seleccionarPeriodo(p: number): void {
    this.periodoSeleccionado = p;
    this.tareaEditando = null;
    this.form.reset();
  }

  // Calcula puntos disponibles en la etiqueta seleccionada
  getPuntosDisponibles(): number | null {
    const etiquetaId = Number(this.form.value.etiqueta_id);
    if (!etiquetaId) return null;

    const etiqueta = this.etiquetasFiltradas.find(e => e.id === etiquetaId);
    if (!etiqueta) return null;

    // Suma puntos ya asignados a otras tareas de esta etiqueta en este periodo
    const puntosAsignados = this.tareasFiltradas
      .filter(t =>
        t.etiqueta_id === etiquetaId &&
        t.valor_propio !== null &&
        // Si estamos editando, excluye la tarea actual
        (!this.tareaEditando || t.id !== this.tareaEditando.id)
      )
      .reduce((sum, t) => sum + (Number(t.valor_propio) || 0), 0);

    return Number(etiqueta.valor_total) - puntosAsignados;
  }

  // ── Guardar ────────────────────────────────────────────────────
  guardar(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (!this.grupoMateriaSeleccionado) return;
    this.isSubmitting = true;

    if (this.tareaEditando) {
      this.tasksService.actualizarTarea(this.tareaEditando.id, {
        nombre:       this.form.value.nombre,
        fecha:        this.form.value.fecha || null,
        periodo:      this.periodoSeleccionado,
        etiqueta_id:  this.esPorPuntos ? Number(this.form.value.etiqueta_id) || null : null,
        valor_propio: this.form.value.valor_propio || null  // ← faltaba esto
      }).subscribe({
        next: () => {
          this.sweetAlert.toast('Tarea actualizada', 'success');
          this.tareaEditando = null;
          this.form.reset();
          this.cargarDatos();
          this.isSubmitting = false;
        },
        error: () => { this.sweetAlert.error('Error', 'No se pudo actualizar'); this.isSubmitting = false; }
      });
    } else {
      const data: CrearTarea = {
        grupo_materia_id: this.grupoMateriaSeleccionado.id,
        nombre:           this.form.value.nombre,
        fecha:            this.form.value.fecha || null,
        periodo:          this.periodoSeleccionado,
        etiqueta_id:      this.esPorPuntos ? Number(this.form.value.etiqueta_id) || null : null,
        valor_propio:     this.form.value.valor_propio || null  // ← faltaba esto
      };
      this.tasksService.crearTarea(data).subscribe({
        next: () => {
          this.sweetAlert.toast('Tarea creada', 'success');
          this.form.reset();
          this.cargarDatos();
          this.isSubmitting = false;
        },
        error: () => { this.sweetAlert.error('Error', 'No se pudo crear'); this.isSubmitting = false; }
      });
    }
  }

  // ── Editar ─────────────────────────────────────────────────────
  editarTarea(tarea: Tarea): void {
    this.tareaEditando = tarea;
    this.form.patchValue({
      nombre:       tarea.nombre,
      fecha:        tarea.fecha?.substring(0, 10),
      etiqueta_id:  tarea.etiqueta_id || '',
      valor_propio: tarea.valor_propio || null  // ← faltaba esto
    });
  }

  cancelarEdicion(): void {
    this.tareaEditando = null;
    this.form.reset();
  }

  // ── Eliminar ───────────────────────────────────────────────────
  async eliminar(tarea: Tarea): Promise<void> {
    const result = await this.sweetAlert.confirmDelete(`¿Eliminar tarea "${tarea.nombre}"?`);
    if (result.isConfirmed) {
      this.tasksService.eliminarTarea(tarea.id).subscribe({
        next: () => { this.sweetAlert.toast('Tarea eliminada', 'success'); this.cargarDatos(); },
        error: () => this.sweetAlert.error('Error', 'No se pudo eliminar')
      });
    }
  }
}
