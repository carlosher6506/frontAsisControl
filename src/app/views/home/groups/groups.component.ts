import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { GroupsService } from '../../../core/services/groups.service';
import { SchoolYearService } from '../../../core/services/school-year.service';
import { AcademicLevelsService } from '../../../core/services/academic-levels.service';
import { EducationLevelsService } from '../../../core/services/education-levels.service';
import { UsersService } from '../../../core/services/users.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { Grupo, CrearGrupo, ActualizarGrupo } from '../../../core/models/group.model';
import { CicloEscolar } from '../../../core/models/school-year.model';
import { NivelAcademico } from '../../../core/models/academic-level.model';
import { NivelEducativo } from '../../../core/models/education-level.model';
import { Usuario } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { StudentsService } from '../../../core/services/students.service';
import { Alumno } from '../../../core/models/student.model';
import { forkJoin, switchMap, throwError } from 'rxjs';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './groups.component.html',
  styleUrl: './groups.component.scss'
})
export class GroupsComponent implements OnInit {

  // ── Datos ──────────────────────────────────────────────────────────────────
  grupos: Grupo[] = [];
  ciclos: CicloEscolar[] = [];
  nivelesEducativos: NivelEducativo[] = [];
  nivelesAcademicos: NivelAcademico[] = [];
  maestros: Usuario[] = [];
  alumnosDelGrupo: Alumno[] = [];
  alumnosDisponibles: Alumno[] = [];
  usuario: any = null;

  // ── Estado UI ──────────────────────────────────────────────────────────────
  isLoading = true;
  isSubmitting = false;
  cargandoAlumnos = false;
  asignandoAlumno = false;
  modoEdicion = false;

  // ── Selección ──────────────────────────────────────────────────────────────
  grupoSeleccionado: Grupo | null = null;
  grupoViendoAlumnos: Grupo | null = null;
  alumnosSeleccionadosIds: number[] = [];
  mostrandoSelectorAlumnos = false;
  textoBusquedaAlumnos = '';

  // ── Filtros ────────────────────────────────────────────────────────────────
  textoBusqueda = '';
  tabActivo = 'todos';

  // ── Paginación ─────────────────────────────────────────────────────────────
  readonly pageSize = 6;
  paginaActual = 1;

  // ── Formulario ─────────────────────────────────────────────────────────────
  form: FormGroup;
  nivelEducativoSeleccionado: number | null = null;
  nivelAcademicoSeleccionado: number | null = null;

  // ──────────────────────────────────────────────────────────────────────────
  constructor(
    private readonly groupsService: GroupsService,
    private readonly schoolYearService: SchoolYearService,
    private readonly academicLevelsService: AcademicLevelsService,
    private readonly educationLevelsService: EducationLevelsService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly sweetAlert: SweetAlertService,
    private readonly studentsService: StudentsService,
    private readonly fb: FormBuilder,
  ) {
    this.usuario = this.authService.getUsuario();
    this.form = this.fb.group({
      nombre:             ['', Validators.required],
      ciclo_escolar_id:   ['', Validators.required],
      maestro_id:         ['', Validators.required],
      nivel_academico_id: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    if (!this.esAdmin) {
      this.form.get('maestro_id')!.clearValidators();
      this.form.get('maestro_id')!.updateValueAndValidity();
    }
    this.cargarDatos();
  }

  // ── Getters form ───────────────────────────────────────────────────────────
  get nombre()             { return this.form.get('nombre')!; }
  get ciclo_escolar_id()   { return this.form.get('ciclo_escolar_id')!; }
  get maestro_id()         { return this.form.get('maestro_id')!; }
  get nivel_academico_id() { return this.form.get('nivel_academico_id')!; }

  get esAdmin(): boolean {
    return this.usuario?.rol?.toLowerCase() === 'admin';
  }

  get nivelesAcademicosFiltrados(): NivelAcademico[] {
    if (!this.nivelEducativoSeleccionado) return [];
    return this.nivelesAcademicos.filter(
      na => na.nivel_educativo_id === Number(this.nivelEducativoSeleccionado)
    );
  }

  // ── Tabs por nivel educativo ───────────────────────────────────────────────
  get nivelesDisponibles(): string[] {
    const niveles = new Set(this.grupos.map(g => g.nivel_educativo || 'Sin nivel'));
    return ['todos', ...Array.from(niveles)];
  }

  cambiarTab(tab: string): void {
    this.tabActivo = tab;
    this.paginaActual = 1;
  }

  // ── Filtrado + paginación ──────────────────────────────────────────────────
  get gruposFiltradosPorTab(): Grupo[] {
    let lista = this.grupos;

    if (this.tabActivo !== 'todos') {
      lista = lista.filter(g => (g.nivel_educativo || 'Sin nivel') === this.tabActivo);
    }

    if (this.textoBusqueda.trim()) {
      const texto = this.textoBusqueda.toLowerCase();
      lista = lista.filter(g =>
        g.nombre.toLowerCase().includes(texto) ||
        (g.nivel_academico || '').toLowerCase().includes(texto) ||
        (g.nivel_educativo || '').toLowerCase().includes(texto) ||
        this.getNombreMaestro(g.maestro_id).toLowerCase().includes(texto)
      );
    }

    return lista;
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.gruposFiltradosPorTab.length / this.pageSize));
  }

  get gruposPaginados(): Grupo[] {
    const inicio = (this.paginaActual - 1) * this.pageSize;
    return this.gruposFiltradosPorTab.slice(inicio, inicio + this.pageSize);
  }

  get paginas(): number[] {
    const total = this.totalPaginas;
    const actual = this.paginaActual;
    const paginas: number[] = [];
    for (let i = Math.max(1, actual - 2); i <= Math.min(total, actual + 2); i++) {
      paginas.push(i);
    }
    return paginas;
  }

  cambiarPagina(p: number): void {
    if (p < 1 || p > this.totalPaginas) return;
    this.paginaActual = p;
  }

  onBusqueda(): void {
    this.paginaActual = 1;
  }

  // ── Helpers nombres ────────────────────────────────────────────────────────
  getNombreNivel(nivel_academico_id: number): string {
    const nivel = this.nivelesAcademicos.find(n => n.id === nivel_academico_id);
    return nivel ? `${nivel.nivel_educativo} - ${nivel.nombre}` : `Nivel ${nivel_academico_id}`;
  }

  getNombreCiclo(ciclo_id: number): string {
    const ciclo = this.ciclos.find(c => c.id === ciclo_id);
    return ciclo ? ciclo.nombre : `Ciclo ${ciclo_id}`;
  }

  getNombreMaestro(maestro_id: number): string {
    const maestro = this.maestros.find(m => m.id === maestro_id);
    if (maestro) return maestro.nombre;
    if (!this.esAdmin && this.usuario?.id === maestro_id) return this.usuario.nombre;
    return `Maestro ${maestro_id}`;
  }

  // ── Carga de datos ─────────────────────────────────────────────────────────
  cargarDatos(): void {
    this.isLoading = true;
    this.groupsService.obtenerGrupos().subscribe({
      next: (data) => { this.grupos = data; this.isLoading = false; },
      error: () => { this.sweetAlert.error('Error', 'No se pudieron cargar los grupos'); this.isLoading = false; }
    });
    this.schoolYearService.obtenerCiclos().subscribe({ next: (data) => this.ciclos = data });
    this.educationLevelsService.obtenerNiveles().subscribe({ next: (data) => this.nivelesEducativos = data });
    this.academicLevelsService.obtenerNiveles().subscribe({ next: (data) => this.nivelesAcademicos = data });

    if (this.esAdmin) {
      this.usersService.obtenerUsuarios().subscribe({
        next: (data) => this.maestros = data.filter(u => u.rol === 'maestro')
      });
    } else {
      this.maestros = this.usuario ? [this.usuario] : [];
    }
  }

  // ── Modal crear ────────────────────────────────────────────────────────────
  abrirModalCrear(): void {
    this.modoEdicion = false;
    this.grupoSeleccionado = null;
    this.nivelEducativoSeleccionado = null;
    this.nivelAcademicoSeleccionado = null;
    this.form.reset();
    // En edición el ciclo y nivel no son requeridos
    this.form.get('ciclo_escolar_id')!.setValidators(Validators.required);
    this.form.get('nivel_academico_id')!.setValidators(Validators.required);
    this.form.get('ciclo_escolar_id')!.updateValueAndValidity();
    this.form.get('nivel_academico_id')!.updateValueAndValidity();
  }

  // ── Modal editar ───────────────────────────────────────────────────────────
  abrirModalEditar(grupo: Grupo): void {
    this.modoEdicion = true;
    this.grupoSeleccionado = grupo;

    // En edición solo se puede cambiar nombre y maestro
    this.form.get('ciclo_escolar_id')!.clearValidators();
    this.form.get('nivel_academico_id')!.clearValidators();
    this.form.get('ciclo_escolar_id')!.updateValueAndValidity();
    this.form.get('nivel_academico_id')!.updateValueAndValidity();

    this.form.patchValue({
      nombre:     grupo.nombre,
      maestro_id: grupo.maestro_id,
    });
  }

  onNivelEducativoChange(): void {
    this.nivelAcademicoSeleccionado = null;
    this.form.get('nivel_academico_id')!.setValue('');
  }

  // ── Guardar ────────────────────────────────────────────────────────────────
  guardar(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.isSubmitting = true;

    const maestroId = this.esAdmin ? Number(this.form.value.maestro_id) : this.usuario!.id;

    if (this.modoEdicion && this.grupoSeleccionado) {
      const data: ActualizarGrupo = {
        nombre:     this.form.value.nombre,
        maestro_id: maestroId,
      };
      this.groupsService.actualizarGrupo(this.grupoSeleccionado.id, data).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.sweetAlert.toast('Grupo actualizado', 'success');
          this.cerrarModal();
          this.cargarDatos();
        },
        error: () => {
          this.isSubmitting = false;
          this.sweetAlert.error('Error', 'No se pudo actualizar el grupo');
        }
      });
    } else {
      const data: CrearGrupo = {
        nombre:             this.form.value.nombre,
        ciclo_escolar_id:   Number(this.form.value.ciclo_escolar_id),
        maestro_id:         maestroId,
        nivel_academico_id: Number(this.form.value.nivel_academico_id),
      };
      this.groupsService.crearGrupo(data).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.sweetAlert.toast('Grupo creado', 'success');
          this.cerrarModal();
          this.cargarDatos();
        },
        error: () => {
          this.isSubmitting = false;
          this.sweetAlert.error('Error', 'No se pudo crear el grupo');
        }
      });
    }
  }

  // ── Eliminar grupo (desasigna alumnos) ─────────────────────────────────────
  async eliminar(grupo: Grupo): Promise<void> {
    const result = await this.sweetAlert.confirmDelete(
      `¿Eliminar el grupo ${grupo.nombre}?`,
      'Los alumnos serán desasignados pero no eliminados'
    );
    if (!result.isConfirmed) return;

    this.groupsService.eliminarGrupo(grupo.id).subscribe({
      next: () => {
        this.sweetAlert.toast('Grupo eliminado. Alumnos desasignados.', 'success');
        this.cargarDatos();
      },
      error: () => this.sweetAlert.error('Error', 'No se pudo eliminar el grupo')
    });
  }

  // ── Ver alumnos del grupo ──────────────────────────────────────────────────
  verAlumnos(grupo: Grupo): void {
    this.grupoViendoAlumnos = grupo;
    this.alumnosDelGrupo = [];
    this.alumnosDisponibles = [];
    this.alumnosSeleccionadosIds = [];
    this.mostrandoSelectorAlumnos = false;
    this.textoBusquedaAlumnos = '';
    this.cargandoAlumnos = true;

    this.studentsService.obtenerAlumnosPorGrupo(grupo.id).subscribe({
      next: (data) => {
        this.alumnosDelGrupo = data;
        this.actualizarAlumnosDisponibles();
        this.cargandoAlumnos = false;
      },
      error: () => {
        this.sweetAlert.error('Error', 'No se pudieron cargar los alumnos');
        this.cargandoAlumnos = false;
      }
    });

    this.studentsService.obtenerAlumnos().subscribe({
      next: (data) => {
        this.alumnosDisponibles = data.filter(alumno =>
          alumno.nivel_educativo === grupo.nivel_educativo &&
          (!alumno.nivel_academico?.trim() || alumno.nivel_academico === grupo.nivel_academico)
        );
        this.actualizarAlumnosDisponibles();
      },
      error: () => this.sweetAlert.error('Error', 'No se pudieron cargar los alumnos disponibles')
    });
  }

  private actualizarAlumnosDisponibles(): void {
    const idsAsignados = new Set(this.alumnosDelGrupo.map(alumno => alumno.id));
    this.alumnosDisponibles = this.alumnosDisponibles
      .filter(alumno => !idsAsignados.has(alumno.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  get alumnosDisponiblesFiltrados(): Alumno[] {
    const texto = this.textoBusquedaAlumnos.trim().toLowerCase();
    if (!texto) return this.alumnosDisponibles;

    return this.alumnosDisponibles.filter(alumno =>
      alumno.nombre.toLowerCase().includes(texto) ||
      alumno.matricula.toLowerCase().includes(texto)
    );
  }

  estaAlumnoSeleccionado(alumnoId: number): boolean {
    return this.alumnosSeleccionadosIds.includes(alumnoId);
  }

  alternarAlumno(alumnoId: number): void {
    this.alumnosSeleccionadosIds = this.estaAlumnoSeleccionado(alumnoId)
      ? this.alumnosSeleccionadosIds.filter(id => id !== alumnoId)
      : [...this.alumnosSeleccionadosIds, alumnoId];
  }

  alternarTodosLosAlumnos(): void {
    const idsVisibles = this.alumnosDisponiblesFiltrados.map(alumno => alumno.id);
    const todosSeleccionados = idsVisibles.every(id => this.estaAlumnoSeleccionado(id));

    this.alumnosSeleccionadosIds = todosSeleccionados
      ? this.alumnosSeleccionadosIds.filter(id => !idsVisibles.includes(id))
      : [...new Set([...this.alumnosSeleccionadosIds, ...idsVisibles])];
  }

  get todosLosAlumnosVisiblesSeleccionados(): boolean {
    return this.alumnosDisponiblesFiltrados.length > 0 &&
      this.alumnosDisponiblesFiltrados.every(alumno => this.estaAlumnoSeleccionado(alumno.id));
  }

  asignarAlumnosAlGrupo(): void {
    if (!this.grupoViendoAlumnos || this.alumnosSeleccionadosIds.length === 0) return;

    const alumnos = this.alumnosDisponibles.filter(alumno =>
      this.alumnosSeleccionadosIds.includes(alumno.id)
    );
    this.asignandoAlumno = true;
    forkJoin(alumnos.map(alumno =>
      this.studentsService.obtenerGruposDeAlumno(alumno.id).pipe(
        switchMap(gruposActuales => {
          const tieneOtroGrado = gruposActuales.some(
            grupo => grupo.nivel_academico_id !== this.grupoViendoAlumnos!.nivel_academico_id
          );
          if (tieneOtroGrado) {
            return throwError(() => new Error('El alumno ya pertenece a otro grado/semestre'));
          }

          const idsDelMismoGrado = gruposActuales
            .filter(grupo => grupo.nivel_academico_id === this.grupoViendoAlumnos!.nivel_academico_id)
            .map(grupo => grupo.id);

          const grupoIds = [...new Set([...idsDelMismoGrado, this.grupoViendoAlumnos!.id])];
          return this.studentsService.asignarAGrupo(alumno, grupoIds);
        })
      )
    )).subscribe({
      next: () => {
        this.asignandoAlumno = false;
        this.sweetAlert.toast(`${alumnos.length} alumno(s) asignado(s) al grupo`, 'success');
        this.alumnosDelGrupo = [...this.alumnosDelGrupo, ...alumnos];
        this.alumnosDisponibles = this.alumnosDisponibles.filter(alumno =>
          !this.alumnosSeleccionadosIds.includes(alumno.id)
        );
        this.alumnosSeleccionadosIds = [];
        this.mostrandoSelectorAlumnos = false;
      },
      error: (error) => {
        this.asignandoAlumno = false;
        this.sweetAlert.error('Error', error?.message || 'No se pudieron asignar los alumnos al grupo');
      }
    });
  }

  // ── Eliminar alumno del grupo ──────────────────────────────────────────────
  async eliminarAlumnoDelGrupo(alumno: Alumno): Promise<void> {
    if (!this.grupoViendoAlumnos) return;
    const result = await this.sweetAlert.confirmDelete(
      `¿Quitar a ${alumno.nombre} de este grupo?`,
      'El alumno no será eliminado del sistema'
    );
    if (!result.isConfirmed) return;

    this.studentsService.desasignarDeGrupo(alumno.id, this.grupoViendoAlumnos.id).subscribe({
      next: () => {
        this.sweetAlert.toast('Alumno desasignado del grupo', 'success');
        this.alumnosDelGrupo = this.alumnosDelGrupo.filter(a => a.id !== alumno.id);
        this.alumnosDisponibles = [...this.alumnosDisponibles, alumno]
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
      },
      error: () => this.sweetAlert.error('Error', 'No se pudo desasignar el alumno')
    });
  }

  // ── Pase de lista (solo botón por ahora) ──────────────────────────────────
  pasarLista(grupo: Grupo): void {
    // Funcionalidad pendiente
  }

  // ── Cerrar modal ───────────────────────────────────────────────────────────
  cerrarModal(): void {
    this.form.reset();
    this.modoEdicion = false;
    this.grupoSeleccionado = null;
    this.nivelEducativoSeleccionado = null;
    this.nivelAcademicoSeleccionado = null;
    const modal = document.getElementById('modalGrupo');
    if (modal) (window as any).bootstrap.Modal.getInstance(modal)?.hide();
  }

  getPaginaInfo(): string {
    const total = this.gruposFiltradosPorTab.length;
    const inicio = (this.paginaActual - 1) * this.pageSize + 1;
    const fin = Math.min(this.paginaActual * this.pageSize, total);
    return total === 0 ? '0 grupos' : `${inicio}–${fin} de ${total}`;
  }
}
