import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule} from '@angular/forms';
import { MateriasService } from '../../../core/services/materias.service';
import { GrupoMateriasService } from '../../../core/services/grupo-materias.service';
import { GroupsService } from '../../../core/services/groups.service';
import { UsersService } from '../../../core/services/users.service';
import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { Materia } from '../../../core/models/subjects.model';
import { GrupoMateria } from '../../../core/models/groupSubject.model';
import { Grupo } from '../../../core/models/group.model';
import { Usuario } from '../../../core/models/user.model';
import { finalize, pipe } from 'rxjs';

const ITEMS_POR_PAGINA = 9;
const NIVEL_TODOS = 'Todos';

@Component({
  selector: 'app-subjects',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './subjects.component.html',
  styleUrl: './subjects.component.scss'
})
export class SubjectsComponent implements OnInit {

  // Datos base
  materias: Materia[] = [];
  grupoMaterias: GrupoMateria[] = [];
  grupos: Grupo[] = [];
  maestros: { id: number; nombre: string }[] = [];
  usuario: Usuario | null = null;

  isLoadingMaterias = true;
  isLoadingAsignaciones = true;
  isSubmittingMateria = false;
  isSubmittingAsignacion = false;
  materiaEditando: Materia | null = null;

  formMateria: FormGroup;
  formAsignacion: FormGroup;

  // Paginación: Catálogo de materias
  paginaMaterias = 1;
  readonly itemsPorPagina = ITEMS_POR_PAGINA;
  // Vista activa: alterna entre Catálogo y Asignación
  vistaActiva: 'catalogo' | 'asignacion' = 'catalogo';

  // Búsqueda + paginación + nivel + maestro: Asignaciones
  busquedaAsignacion = '';
  nivelSeleccionado: string = NIVEL_TODOS;
  maestroSeleccionado: number | 'todos' = 'todos';
  paginaAsignaciones = 1;
  readonly NIVEL_TODOS = NIVEL_TODOS;

  constructor(
    private materiasService: MateriasService,
    private grupoMateriasService: GrupoMateriasService,
    private groupsService: GroupsService,
    private usersService: UsersService,
    private authService: AuthService,
    private sweetAlert: SweetAlertService,
    private fb: FormBuilder
  ) {
    this.usuario = this.authService.getUsuario();

    this.formMateria = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]]
    });

    this.formAsignacion = this.fb.group({
      grupo_id:   ['', Validators.required],
      materia_id: ['', Validators.required],
      maestro_id: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  get esAdmin(): boolean {
    return this.usuario?.rol?.toLowerCase() === 'admin';
  }

  cargarDatos(): void {
    this.isLoadingMaterias = true;
    this.isLoadingAsignaciones = true;

    this.materiasService.obtenerMaterias()
      .pipe(finalize(() => (this.isLoadingMaterias = false)))
      .subscribe({
        next: (data) => {
          this.materias = data;
          this.clampPagina('materias');
        },
        error: () => this.sweetAlert.error('Error', 'No se pudieron cargar las materias')
      });

    this.grupoMateriasService.obtenerGrupoMaterias()
      .pipe(finalize(() => (this.isLoadingAsignaciones = false)))
      .subscribe({
        next: (data) => {
          this.grupoMaterias = data;
          this.clampPagina('asignaciones');
        },
        error: () => this.sweetAlert.error('Error', 'No se pudieron cargar las asignaciones')
      });

    this.groupsService.obtenerGrupos().subscribe({
      next: (data) => { this.grupos = data; }
    });

    if (this.esAdmin) {
      this.usersService.obtenerUsuarios().subscribe({
        next: (data) => this.maestros = data.filter(u => u.rol === 'maestro')
      });
    } else {
      this.maestros = this.usuario ? [{ id: this.usuario.id, nombre: this.usuario.nombre }] : [];
      this.formAsignacion.get('maestro_id')!.setValue(this.usuario?.id);
    }
  }

  // Crud para las Materias
  guardarMateria(): void {
    if (this.formMateria.invalid) { this.formMateria.markAllAsTouched(); return; }
    this.isSubmittingMateria = true;
    const payload = { nombre: this.formMateria.value.nombre.trim() };

    if (this.materiaEditando) {
      this.materiasService.actualizarMateria(this.materiaEditando.id, payload)
        .pipe(finalize(() => (this.isSubmittingMateria = false)))
        .subscribe({
          next: () => {
            this.sweetAlert.toast('Materia actualizada', 'success');
            this.materiaEditando = null;
            this.formMateria.reset();
            this.cargarDatos();
          },
          error: (err) => this.sweetAlert.error('Error', err.error?.message || 'No se pudo actualizar')
        });
    } else {
      this.materiasService.crearMateria(payload)
        .pipe(finalize(() => (this.isSubmittingMateria = false)))
        .subscribe({
          next: () => {
            this.sweetAlert.toast('Materia creada', 'success');
            this.formMateria.reset();
            this.cargarDatos();
          },
          error: (err) => this.sweetAlert.error('Error', err.error?.message || 'No se pudo crear')
        });
    }
  }

  editarMateria(materia: Materia): void {
    this.materiaEditando = materia;
    this.formMateria.patchValue({ nombre: materia.nombre });
  }

  cancelarEdicionMateria(): void {
    this.materiaEditando = null;
    this.formMateria.reset();
  }

  async eliminarMateria(materia: Materia): Promise<void> {
    const result = await this.sweetAlert.confirmDelete(`¿Eliminar materia "${materia.nombre}"?`);
    if (result.isConfirmed) {
      this.materiasService.eliminarMateria(materia.id).subscribe({
        next: () => {
          this.sweetAlert.toast('Materia eliminada', 'success');
          this.cargarDatos();
        },
        error: (err) => this.sweetAlert.error('Error', err.error?.message || 'No se pudo eliminar')
      });
    }
  }

  getNombreCompletoGrupo(grupo: Grupo): string {
    return `${grupo.nivel_educativo || ''} ${grupo.nivel_academico || ''} ${grupo.nombre}`.trim();
  }

  // Asignacion
  asignarMateria(): void {
    if (this.formAsignacion.invalid) { this.formAsignacion.markAllAsTouched(); return; }
    this.isSubmittingAsignacion = true;

    const data = {
      grupo_id:   Number(this.formAsignacion.value.grupo_id),
      materia_id: Number(this.formAsignacion.value.materia_id),
      maestro_id: Number(this.formAsignacion.value.maestro_id)
    };

    this.grupoMateriasService.asignarMateria(data)
      .pipe(finalize(() => (this.isSubmittingAsignacion = false)))
      .subscribe({
        next: () => {
          this.sweetAlert.toast('Materia asignada al grupo', 'success');
          this.formAsignacion.reset();
          if (!this.esAdmin) this.formAsignacion.get('maestro_id')!.setValue(this.usuario?.id);
          this.cargarDatos();
        },
        error: (err) => this.sweetAlert.error('Error', err.error?.message || 'No se pudo asignar')
      });
  }

  async eliminarAsignacion(gm: GrupoMateria): Promise<void> {
    const result = await this.sweetAlert.confirmDelete(
      `¿Quitar "${gm.materia_nombre}" del grupo ${gm.grupo_nombre}?`
    );
    if (result.isConfirmed) {
      this.grupoMateriasService.eliminarGrupoMateria(gm.id).subscribe({
        next: () => {
          this.sweetAlert.toast('Asignación eliminada', 'success');
          this.cargarDatos();
        },
        error: (err) => this.sweetAlert.error('Error', err.error?.message || 'No se pudo eliminar')
      });
    }
  }

  // Paginacion para el catalogo

  get totalPaginasMaterias(): number {
    return Math.max(1, Math.ceil(this.materias.length / this.itemsPorPagina));
  }

  get materiasPaginadas(): Materia[] {
    const inicio = (this.paginaMaterias - 1) * this.itemsPorPagina;
    return this.materias.slice(inicio, inicio + this.itemsPorPagina);
  }

  cambiarPaginaMaterias(delta: number): void {
    const nueva = this.paginaMaterias + delta;
    if (nueva >= 1 && nueva <= this.totalPaginasMaterias) {
      this.paginaMaterias = nueva;
    }
  }

  // Paginacion, busqueda y filtro para asignaciones

  private nivelDe(gm: GrupoMateria): string {
    return gm.nivel_educativo?.trim() || 'Sin nivel';
  }

  get nivelesDisponibles(): string[] {
    const set = new Set(this.grupoMaterias.map(gm => this.nivelDe(gm)));
    return [this.NIVEL_TODOS, ...Array.from(set).sort()];
  }

  get maestrosEnAsignaciones(): { id: number; nombre: string }[] {
    const mapa = new Map<number, string>();
    this.grupoMaterias.forEach(gm => {
      if (gm.maestro_id != null) mapa.set(gm.maestro_id, gm.maestro_nombre || `Maestro ${gm.maestro_id}`);
    });
    return Array.from(mapa, ([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  get hayFiltrosActivosAsignacion(): boolean {
    return !!this.busquedaAsignacion || this.nivelSeleccionado !== this.NIVEL_TODOS || this.maestroSeleccionado !== 'todos';
  }

  get asignacionesFiltradas(): GrupoMateria[] {
    const termino = this.busquedaAsignacion.trim().toLowerCase();

    return this.grupoMaterias.filter(gm => {
      const coincideNivel = this.nivelSeleccionado === this.NIVEL_TODOS
        || this.nivelDe(gm) === this.nivelSeleccionado;

      const coincideMaestro = this.maestroSeleccionado === 'todos'
        || gm.maestro_id === this.maestroSeleccionado;

      if (!coincideNivel || !coincideMaestro) return false;
      if (!termino) return true;

      return (gm.materia_nombre || '').toLowerCase().includes(termino)
        || (gm.grupo_nombre || '').toLowerCase().includes(termino)
        || (gm.maestro_nombre || '').toLowerCase().includes(termino);
    });
  }

  get totalPaginasAsignaciones(): number {
    return Math.max(1, Math.ceil(this.asignacionesFiltradas.length / this.itemsPorPagina));
  }

  get asignacionesPaginadas(): GrupoMateria[] {
    const inicio = (this.paginaAsignaciones - 1) * this.itemsPorPagina;
    return this.asignacionesFiltradas.slice(inicio, inicio + this.itemsPorPagina);
  }

  seleccionarNivel(nivel: string): void {
    this.nivelSeleccionado = nivel;
    this.paginaAsignaciones = 1;
  }

  onBuscarAsignacion(valor: string): void {
    this.busquedaAsignacion = valor;
    this.paginaAsignaciones = 1;
  }

  onFiltrarMaestro(valor: string): void {
    this.maestroSeleccionado = valor === 'todos' ? 'todos' : Number(valor);
    this.paginaAsignaciones = 1;
  }

  limpiarFiltrosAsignacion(): void {
    this.busquedaAsignacion = '';
    this.nivelSeleccionado = this.NIVEL_TODOS;
    this.maestroSeleccionado = 'todos';
    this.paginaAsignaciones = 1;
  }

  cambiarPaginaAsignaciones(delta: number): void {
    const nueva = this.paginaAsignaciones + delta;
    if (nueva >= 1 && nueva <= this.totalPaginasAsignaciones) {
      this.paginaAsignaciones = nueva;
    }
  }

  private clampPagina(tipo: 'materias' | 'asignaciones'): void {
    if (tipo === 'materias' && this.paginaMaterias > this.totalPaginasMaterias) {
      this.paginaMaterias = this.totalPaginasMaterias;
    }
    if (tipo === 'asignaciones' && this.paginaAsignaciones > this.totalPaginasAsignaciones) {
      this.paginaAsignaciones = this.totalPaginasAsignaciones;
    }
  }

  irAPaginaMaterias(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginasMaterias) {
      this.paginaMaterias = pagina;
    }
  }

  irAPaginaAsignaciones(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginasAsignaciones) {
      this.paginaAsignaciones = pagina;
    }
  }

  paginasVisibles(paginaActual: number, totalPaginas: number): (number | '...')[] {
    const vecinas = 1;
    const paginas: (number | '...')[] = [];

    for (let i = 1; i <= totalPaginas; i++) {
      const esBorde = i === 1 || i === totalPaginas;
      const esVecina = i >= paginaActual - vecinas && i <= paginaActual + vecinas;

      if (esBorde || esVecina) {
        paginas.push(i);
      } else if (paginas[paginas.length - 1] !== '...') {
        paginas.push('...');
      }
    }
    return paginas;
  }
}
