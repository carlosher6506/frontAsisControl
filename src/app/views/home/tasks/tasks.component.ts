import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { EtiquetasService } from '../../../core/services/etiquetas.service';
import { EvaluationsService } from '../../../core/services/evaluations.service';
import { GrupoMateriasService } from '../../../core/services/grupo-materias.service';
import { GroupsService } from '../../../core/services/groups.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { TasksService } from '../../../core/services/tasks.service';
import { ConfiguracionEvaluacion } from '../../../core/models/evaluation.model';
import { Grupo } from '../../../core/models/group.model';
import { GrupoMateria } from '../../../core/models/groupSubject.model';
import { Etiqueta } from '../../../core/models/label.model';
import { CrearTarea, FiltrosGrupoTareas, Tarea } from '../../../core/models/task.model';
import { Usuario } from '../../../core/models/user.model';
import { FILTROS_INICIALES, ORDEN_NIVELES_EDUCATIVOS } from '../../../core/constants/task.constants';
import { gradoAOrdinal, grupoCoincideConFiltros, normalizarTexto } from '../../../core/utils/task.utils';

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
  usuario: Usuario | null;

  isLoading = true;
  isSubmitting = false;
  modalAbierto = false;
  tareaEditando: Tarea | null = null;
  grupoSeleccionado: Grupo | null = null;
  grupoMateriaSeleccionado: GrupoMateria | null = null;
  periodoSeleccionado = 1;
  textoBusquedaTareas = '';
  nivelActivo = '';
  mostrarFiltros = false;
  filtros: FiltrosGrupoTareas = { ...FILTROS_INICIALES };
  form: FormGroup;

  constructor(
    private readonly tasksService: TasksService,
    private readonly grupoMateriasService: GrupoMateriasService,
    private readonly groupsService: GroupsService,
    private readonly evaluationsService: EvaluationsService,
    private readonly etiquetasService: EtiquetasService,
    private readonly authService: AuthService,
    private readonly sweetAlert: SweetAlertService,
    private readonly fb: FormBuilder
  ) {
    this.usuario = this.authService.getUsuario();
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(150)]],
      fecha: [''],
      etiqueta_id: [''],
      valor_propio: [null, [Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modalAbierto)
      this.cerrarModal();
  }

  get esAdmin(): boolean {
    return this.usuario?.rol?.toLowerCase() === 'admin';
  }

  get esPorPuntos(): boolean {
    return this.configEvaluacion?.tipo_evaluacion === 'puntos';
  }

  get nivelesEducativos(): string[] {
    const niveles = [...new Set(
      this.gruposVisibles.map(g => g.nivel_educativo).filter(Boolean) as string[]
    )];
    return niveles.sort((a, b) => {
      const posicionA = ORDEN_NIVELES_EDUCATIVOS.indexOf(a as never);
      const posicionB = ORDEN_NIVELES_EDUCATIVOS.indexOf(b as never);
      return (posicionA === -1 ? Number.MAX_SAFE_INTEGER : posicionA) - (posicionB === -1 ? Number.MAX_SAFE_INTEGER : posicionB) || a.localeCompare(b);
    });
  }
  get gruposVisibles(): Grupo[] {
    return this.esAdmin ? this.grupos : this.grupos.filter(g => g.maestro_id === this.usuario?.id);
  }
  get gruposFiltrados(): Grupo[] {
    return this.gruposVisibles.filter(grupo =>
      (!this.nivelActivo || grupo.nivel_educativo === this.nivelActivo) &&
      grupoCoincideConFiltros(grupo, this.materiasDelGrupo(grupo.id), this.filtros)
    );
  }
  get nivelesAcademicos(): string[] {
    return this.opcionesUnicas(this.gruposVisibles.map(g => g.nivel_academico));
  }

  get nombresGrupos(): string[] {
    return this.opcionesUnicas(this.gruposVisibles.map(g => g.nombre));
  }

  get materias(): string[] {
    return this.opcionesUnicas(this.grupoMaterias.map(gm => gm.materia_nombre));
  }

  get configEvaluacion(): ConfiguracionEvaluacion | null {
    return this.grupoSeleccionado ? this.evaluaciones.find(e => e.grupo_id === this.grupoSeleccionado!.id) ?? null : null;
  }

  get materiasFiltradas(): GrupoMateria[] {
    return this.grupoSeleccionado ? this.materiasDelGrupo(this.grupoSeleccionado.id) : [];
  }

  get periodos(): number[] {
    return Array.from({
      length: this.configEvaluacion?.num_periodos ?? 1
    }, (_, index) => index + 1);
  }

  get nombrePeriodo(): string {
    return this.configEvaluacion?.tipo_periodo === 'trimestre' ? 'Trimestre' : 'Parcial';
  }

  get etiquetasFiltradas(): Etiqueta[] {
    return this.configEvaluacion ? this.etiquetas.filter(e => e.configuracion_id === this.configEvaluacion!.id) : [];
  }
  get tareasFiltradas(): Tarea[] {
    if (!this.grupoMateriaSeleccionado) return [];
    const busqueda = normalizarTexto(this.textoBusquedaTareas);
    return this.tareas.filter(
      t => t.grupo_materia_id === this.grupoMateriaSeleccionado!.id && t.periodo === this.periodoSeleccionado && (
        !busqueda || normalizarTexto(t.nombre).includes(busqueda)
      )
    );
  }

  get hayFiltrosActivos(): boolean {
    return Object.values(this.filtros).some(Boolean);
  }

  cargarDatos(): void {
    this.isLoading = true;
    forkJoin({
      grupos: this.groupsService.obtenerGrupos(),
      grupoMaterias: this.grupoMateriasService.obtenerGrupoMaterias(),
      evaluaciones: this.evaluationsService.obtenerEvaluaciones(),
      etiquetas: this.etiquetasService.obtenerEtiquetas(),
      tareas: this.tasksService.obtenerTareas()
    }).subscribe({
      next: ({ grupos, grupoMaterias, evaluaciones, etiquetas, tareas }) => {
        this.grupos = grupos;
        this.grupoMaterias = this.esAdmin ? grupoMaterias : grupoMaterias.filter(
          gm => gm.maestro_id === this.usuario?.id
        );
        this.evaluaciones = evaluaciones;
        this.etiquetas = etiquetas;
        this.tareas = tareas;
        if (!this.nivelActivo) this.nivelActivo = this.nivelesEducativos[0] ?? '';
        this.isLoading = false;
      },
      error: () => {
        this.sweetAlert.error('Error', 'No se pudieron cargar los datos de tareas'); this.isLoading = false;
      }
    });
  }

  seleccionarNivel(nivel: string): void {
    this.nivelActivo = nivel;
  }

  alternarFiltros(): void {
    this.mostrarFiltros = !this.mostrarFiltros;
  }

  seleccionarGrupo(grupo: Grupo): void {
    this.grupoSeleccionado = grupo;
    this.grupoMateriaSeleccionado = null;
    this.periodoSeleccionado = 1;
    this.tareaEditando = null;
    this.form.reset();
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.grupoSeleccionado = null;
    this.grupoMateriaSeleccionado = null;
    this.tareaEditando = null;
    this.textoBusquedaTareas = '';
    this.form.reset();
  }

  seleccionarMateria(materia: GrupoMateria): void {
    this.grupoMateriaSeleccionado = materia;
    this.periodoSeleccionado = 1;
    this.tareaEditando = null;
    this.form.reset();
  }

  seleccionarPeriodo(periodo: number): void {
    this.periodoSeleccionado = periodo; this.cancelarEdicion();
  }

  limpiarFiltros(): void {
    this.filtros = { ...FILTROS_INICIALES };
  }

  obtenerNombreGrupo(grupo: Grupo): string {
    const nivel = String(grupo.nivel_academico ?? '').trim();
    const grado = Number(nivel.match(/\d+/)?.[0]);
    const descripcionNivel = grado ? `${gradoAOrdinal(grado)}` : nivel;
    const nombreGrupo = String(grupo.nombre ?? '').replace(/^Grupo\s*/i, '').trim();
    return `${descripcionNivel}${nombreGrupo ? ` Grupo ${nombreGrupo}` : ''}`.trim();
  }

  materiasDelGrupo(grupoId: number): GrupoMateria[] {
    return this.grupoMaterias.filter(gm => gm.grupo_id === grupoId);
  }

  getPuntosDisponibles(): number | null {
    const etiquetaId = Number(this.form.value.etiqueta_id);
    if (!etiquetaId) return null;
    const etiqueta = this.etiquetasFiltradas.find(e => e.id === etiquetaId);
    if (!etiqueta) return null;
    const asignados = this.tareasFiltradas.filter(
      t => t.etiqueta_id === etiquetaId && t.valor_propio !== null && t.id !== this.tareaEditando?.id)
      .reduce((total, tarea) => total + (Number(tarea.valor_propio) || 0), 0);
    return Math.max(0, Number(etiqueta.valor_total) - asignados);
  }

  guardar(): void {
    if (this.form.invalid || !this.grupoMateriaSeleccionado) { this.form.markAllAsTouched(); return; }
    const nombre = String(this.form.value.nombre ?? '').trim();
    if (!nombre) {
      this.form.get('nombre')?.setErrors({ required: true });
      this.form.get('nombre')?.markAsTouched();
      return;
    }
    const disponible = this.getPuntosDisponibles();
    const valorPropio = this.form.value.valor_propio === null || this.form.value.valor_propio === '' ? null : Number(this.form.value.valor_propio);
    if (valorPropio !== null && (Number.isNaN(valorPropio) || (disponible !== null && valorPropio > disponible))) {
      this.sweetAlert.error('Valor inválido', 'Los puntos asignados no pueden superar los puntos disponibles.');
      return;
    }
    const data: CrearTarea = {
      grupo_materia_id: this.grupoMateriaSeleccionado.id,
      nombre,
      fecha: this.form.value.fecha || null,
      periodo: this.periodoSeleccionado,
      etiqueta_id: this.esPorPuntos ? Number(this.form.value.etiqueta_id) || null : null,
      valor_propio: this.esPorPuntos ? valorPropio : null
    };
    this.isSubmitting = true;
    const solicitud = this.tareaEditando ? this.tasksService.actualizarTarea(this.tareaEditando.id, data) : this.tasksService.crearTarea(data);
    solicitud.subscribe({
      next: () => {
        this.sweetAlert.toast(this.tareaEditando ? 'Tarea actualizada' : 'Tarea creada', 'success');
        this.cancelarEdicion();
        this.cargarDatos();
        this.isSubmitting = false;
      },
      error: () => {
        this.sweetAlert.error('Error', 'No se pudo guardar la tarea');
        this.isSubmitting = false;
      }
    });
  }

  editarTarea(tarea: Tarea): void {
    this.tareaEditando = tarea;
    this.form.patchValue({
      nombre: tarea.nombre,
      fecha: tarea.fecha?.substring(0, 10),
      etiqueta_id: tarea.etiqueta_id || '',
      valor_propio: tarea.valor_propio ?? null
    });
  }

  cancelarEdicion(): void {
    this.tareaEditando = null; this.form.reset();
  }

  async eliminar(tarea: Tarea): Promise<void> {
    const result = await this.sweetAlert.confirmDelete(`¿Eliminar tarea "${tarea.nombre}"?`);
    if (!result.isConfirmed) return;
    this.tasksService.eliminarTarea(tarea.id).subscribe({
      next: () => {
        this.sweetAlert.toast('Tarea eliminada', 'success');
        this.cargarDatos();
      },
      error: () => this.sweetAlert.error('Error', 'No se pudo eliminar la tarea') });
  }

  private opcionesUnicas(
    valores: Array<string | undefined>): string[] {
      return [...new Set(
        valores.filter(
          (valor): valor is string => Boolean(valor)
        ))
      ].sort((a, b) => a.localeCompare(b));
    }
}
