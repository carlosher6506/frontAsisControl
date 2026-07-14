import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { StudentsService } from '../../../core/services/students.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { Alumno, CrearAlumno } from '../../../core/models/student.model';
import { GroupsService } from '../../../core/services/groups.service';
import { EducationLevelsService } from '../../../core/services/education-levels.service';
import { AcademicLevelsService } from '../../../core/services/academic-levels.service';
import { Grupo, } from '../../../core/models/group.model';
import { NivelEducativo } from '../../../core/models/education-level.model';
import { NivelAcademico } from '../../../core/models/academic-level.model';
import * as XLSX from 'xlsx';

interface NivelConAlumnos {
  nombre: string;
  alumnos: Alumno[];
}

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './students.component.html',
  styleUrl: './students.component.scss'
})
export class StudentsComponent implements OnInit {

  alumnos: Alumno[] = [];
  grupos: Grupo[] = [];
  nivelesEducativos: NivelEducativo[] = [];
  nivelesAcademicos: NivelAcademico[] = [];

  nivelEducativoSeleccionado: number | null = null;
  nivelAcademicoSeleccionado: number | null = null;
  gruposSeleccionados: number[] = [];

  filtroGrado: { [nivel: string]: string } = {};
  filtroGrupo: { [nivel: string]: string } = {};
  filtroCiclo: { [nivel: string]: string } = {};

  isLoading = true;
  isSubmitting = false;
  modoEdicion = false;
  alumnoSeleccionado: Alumno | null = null;
  textoBusqueda = '';

  // Tabs
  tabActivo = 'todos';
  mostrarFiltros = false;

  // Paginación: mapa { nombreNivel -> paginaActual }
  readonly pageSize = 15;
  private paginasPorNivel: Map<string, number> = new Map();

  alumnosExcel: { nombre: string; nivel_educativo: string; grado: string; grupo: string }[] = [];
  importando = false;

  form: FormGroup;

  constructor(
    private studentsService: StudentsService,
    private groupsService: GroupsService,
    private educationLevelsService: EducationLevelsService,
    private academicLevelsService: AcademicLevelsService,
    private sweetAlert: SweetAlertService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      nombre:   ['', [Validators.required, Validators.minLength(3)]],
      grupo_id: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  // ─── Form getters ───────────────────────────────────────
  get nombre()   { return this.form.get('nombre')!; }
  get grupo_id() { return this.form.get('grupo_id')!; }

  // ─── Búsqueda ────────────────────────────────────────────
  onBusqueda(): void {
    this.paginasPorNivel.clear();
  }

  get alumnosFiltrados(): Alumno[] {
    if (!this.textoBusqueda.trim()) return this.alumnos;
    const texto = this.textoBusqueda.toLowerCase();
    return this.alumnos.filter(a =>
      a.nombre.toLowerCase().includes(texto) ||
      a.matricula?.toLowerCase().includes(texto)
    );
  }

  // ─── Tablas por nivel educativo ──────────────────────────
  get nivelesConAlumnos(): NivelConAlumnos[] {
    const mapa = new Map<string, Alumno[]>();
    for (const alumno of this.alumnosFiltrados) {
      const nivel = alumno.nivel_educativo || 'Sin nivel';
      if (!mapa.has(nivel)) mapa.set(nivel, []);
      mapa.get(nivel)!.push(alumno);
    }
    return Array.from(mapa.entries()).map(([nombre, alumnos]) => ({ nombre, alumnos }));
  }

  get totalAlumnosFiltrados(): number {
    return this.alumnosFiltrados.length;
  }

  // ─── Paginación ──────────────────────────────────────────
  getPaginaActiva(nivel: NivelConAlumnos): number {
    return this.paginasPorNivel.get(nivel.nombre) ?? 1;
  }

  getTotalPaginas(nivel: NivelConAlumnos): number {
    return Math.ceil(nivel.alumnos.length / this.pageSize);
  }

  getPaginas(nivel: NivelConAlumnos): number[] {
    const total = this.getTotalPaginas(nivel);
    const actual = this.getPaginaActiva(nivel);
    const paginas: number[] = [];
    const rango = 2;
    for (let i = Math.max(1, actual - rango); i <= Math.min(total, actual + rango); i++) {
      paginas.push(i);
    }
    return paginas;
  }

  getPaginaActual(nivel: NivelConAlumnos): Alumno[] {
    const pagina = this.getPaginaActiva(nivel);
    const inicio = (pagina - 1) * this.pageSize;
    return nivel.alumnos.slice(inicio, inicio + this.pageSize);
  }

  getPaginaInfo(nivel: NivelConAlumnos): string {
    const pagina = this.getPaginaActiva(nivel);
    const inicio = (pagina - 1) * this.pageSize + 1;
    const fin = Math.min(pagina * this.pageSize, nivel.alumnos.length);
    return `Mostrando ${inicio}–${fin} de ${nivel.alumnos.length}`;
  }

  cambiarPagina(nivel: NivelConAlumnos, pagina: number): void {
    const total = this.getTotalPaginas(nivel);
    if (pagina < 1 || pagina > total) return;
    this.paginasPorNivel.set(nivel.nombre, pagina);
  }

  // ─── Selects dependientes ────────────────────────────────
  get nivelesAcademicosFiltrados(): NivelAcademico[] {
    if (!this.nivelEducativoSeleccionado) return [];
    return this.nivelesAcademicos.filter(
      na => na.nivel_educativo_id === Number(this.nivelEducativoSeleccionado)
    );
  }

  get gruposFiltrados(): Grupo[] {
    if (!this.nivelAcademicoSeleccionado) return [];
    return this.grupos.filter(
      g => g.nivel_academico_id === Number(this.nivelAcademicoSeleccionado)
    );
  }

  onNivelEducativoChange(): void {
    this.nivelAcademicoSeleccionado = null;
    this.form.get('grupo_id')!.setValue('');
    this.gruposSeleccionados = [];
  }

  onNivelAcademicoChange(): void {
    this.form.get('grupo_id')!.setValue('');
    this.gruposSeleccionados = [];
  }

  toggleGrupo(grupoId: number): void {
    const idx = this.gruposSeleccionados.indexOf(grupoId);
    idx === -1 ? this.gruposSeleccionados.push(grupoId) : this.gruposSeleccionados.splice(idx, 1);
  }

  isGrupoSeleccionado(grupoId: number): boolean {
    return this.gruposSeleccionados.includes(grupoId);
  }

  // ─── Carga de datos ──────────────────────────────────────
  cargarDatos(): void {
    this.isLoading = true;
    this.studentsService.obtenerAlumnos().subscribe({
      next: (data) => { this.alumnos = data; this.isLoading = false;
        if (this.nivelesConAlumnos.length > 0) {
          this.tabActivo = this.nivelesConAlumnos[0].nombre;
        }
      },
      error: () => {
        this.sweetAlert.error('Error', 'No se pudieron cargar los alumnos');
        this.isLoading = false;
      }
    });
    this.groupsService.obtenerGrupos().subscribe({ next: (data) => this.grupos = data });
    this.educationLevelsService.obtenerNiveles().subscribe({ next: (data) => this.nivelesEducativos = data });
    this.academicLevelsService.obtenerNiveles().subscribe({ next: (data) => this.nivelesAcademicos = data });
  }

getGradosDeNivel(nivel: NivelConAlumnos): string[] {
  return [...new Set(nivel.alumnos.map(a => a.nivel_academico).filter(Boolean))];
}

  // ─── Modal crear ─────────────────────────────────────────
  abrirModalCrear(): void {
    this.modoEdicion = false;
    this.alumnoSeleccionado = null;
    this.nivelEducativoSeleccionado = null;
    this.nivelAcademicoSeleccionado = null;
    this.gruposSeleccionados = [];
    this.form.reset();
    this.form.get('grupo_id')!.setValidators(Validators.required);
    this.form.get('grupo_id')!.updateValueAndValidity();
  }

  getGruposDeNivel(nivel: NivelConAlumnos): string[] {
    let alumnos = nivel.alumnos;
    const grado = this.filtroGrado[nivel.nombre];
    if (grado) alumnos = alumnos.filter(a => a.nivel_academico === grado);

    // Recoger todos los grupos de todos los alumnos
    const grupos = new Set<string>();
    alumnos.forEach(a => {
      if (a.grupos_nombres?.length) {
        a.grupos_nombres.forEach(g => grupos.add(g));
      } else if (a.grupo_nombre) {
        grupos.add(a.grupo_nombre);
      }
    });
    return [...grupos].sort();
  }

  getAlumnosFiltradosPorNivel(nivel: NivelConAlumnos): Alumno[] {
    let alumnos = nivel.alumnos;
    const grado = this.filtroGrado[nivel.nombre];
    const grupo = this.filtroGrupo[nivel.nombre];
    const ciclo = this.filtroCiclo[nivel.nombre];

    if (grado) alumnos = alumnos.filter(a => a.nivel_academico === grado);
    if (ciclo) alumnos = alumnos.filter(a => a.ciclo_escolar === ciclo);
    if (grupo) alumnos = alumnos.filter(a =>
      a.grupos_nombres?.includes(grupo) || a.grupo_nombre === grupo
    );

    // Sin duplicados
    const vistos = new Set<number>();
    return alumnos.filter(a => {
      if (vistos.has(a.id)) return false;
      vistos.add(a.id);
      return true;
    });
  }

  onFiltroGradoChange(nivel: NivelConAlumnos): void {
    this.filtroGrupo[nivel.nombre] = '';
    this.paginasPorNivel.clear();
  }

  onFiltroGrupoChange(): void {
    this.paginasPorNivel.clear();
  }

  limpiarFiltros(nivel: NivelConAlumnos): void {
    this.filtroGrado[nivel.nombre]  = '';
    this.filtroGrupo[nivel.nombre]  = '';
    this.filtroCiclo[nivel.nombre]  = '';
    this.paginasPorNivel.clear();
  }

  getPaginaActualFiltrada(nivel: NivelConAlumnos): Alumno[] {
    const alumnos = this.getAlumnosFiltradosPorNivel(nivel);
    const pagina = this.getPaginaActiva(nivel);
    const inicio = (pagina - 1) * this.pageSize;
    return alumnos.slice(inicio, inicio + this.pageSize);
  }

  getTotalPaginasFiltradas(nivel: NivelConAlumnos): number {
    return Math.ceil(this.getAlumnosFiltradosPorNivel(nivel).length / this.pageSize);
  }

  getPaginasFiltradas(nivel: NivelConAlumnos): number[] {
    const total = this.getTotalPaginasFiltradas(nivel);
    const actual = this.getPaginaActiva(nivel);
    const paginas: number[] = [];
    for (let i = Math.max(1, actual - 2); i <= Math.min(total, actual + 2); i++) {
      paginas.push(i);
    }
    return paginas;
  }

  toggleFiltros(): void {
    this.mostrarFiltros = !this.mostrarFiltros;
  }

  tieneFiltrosActivos(nivel: NivelConAlumnos): boolean {
    return !!(this.filtroGrado[nivel.nombre] || this.filtroGrupo[nivel.nombre] || this.filtroCiclo[nivel.nombre]);
  }

  getPaginaInfoFiltrada(nivel: NivelConAlumnos): string {
    const alumnos = this.getAlumnosFiltradosPorNivel(nivel);
    const pagina = this.getPaginaActiva(nivel);
    const inicio = (pagina - 1) * this.pageSize + 1;
    const fin = Math.min(pagina * this.pageSize, alumnos.length);
    return `Mostrando ${inicio}-${fin}`;
  }

  getCiclosDeNivel(nivel: NivelConAlumnos): string[] {
    return [...new Set(nivel.alumnos.map(a => a.ciclo_escolar).filter(Boolean))];
  }

  // ─── Modal editar ─────────────────────────────────────────
  abrirModalEditar(alumno: Alumno): void {
    this.modoEdicion = true;
    this.alumnoSeleccionado = alumno;
    this.gruposSeleccionados = [];

    this.form.get('grupo_id')!.clearValidators();
    this.form.get('grupo_id')!.updateValueAndValidity();

    this.form.patchValue({ nombre: alumno.nombre });

    if (alumno.grupo_id) {
      const grupo = this.grupos.find(g => g.id === alumno.grupo_id);
      if (grupo) {
        const nivelAcademico = this.nivelesAcademicos.find(na => na.id === grupo.nivel_academico_id);
        if (nivelAcademico) {
          this.nivelEducativoSeleccionado = nivelAcademico.nivel_educativo_id;
          this.nivelAcademicoSeleccionado = nivelAcademico.id;
        }
      }
    }

    this.studentsService.obtenerGruposDeAlumno(alumno.id).subscribe({
      next: (grupos) => { this.gruposSeleccionados = grupos.map((g: any) => g.id); },
      error: () => { if (alumno.grupo_id) this.gruposSeleccionados = [alumno.grupo_id]; }
    });
  }

  // ─── Guardar ─────────────────────────────────────────────
  guardar(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.isSubmitting = true;

    if (this.modoEdicion && this.alumnoSeleccionado) {
      if (this.gruposSeleccionados.length === 0) {
        this.sweetAlert.error('Error', 'Debes seleccionar al menos un grupo');
        this.isSubmitting = false;
        return;
      }
      const data = {
        nombre:    this.form.value.nombre,
        grupo_id:  this.gruposSeleccionados[0],
        grupo_ids: this.gruposSeleccionados
      };
      this.studentsService.actualizarAlumno(this.alumnoSeleccionado.id, data).subscribe({
        next: () => { this.sweetAlert.toast('Alumno actualizado', 'success'); this.cerrarModal(); this.cargarDatos(); this.isSubmitting = false; },
        error: (err) => { this.sweetAlert.error('Error', err?.error?.message || 'No se pudo actualizar'); this.isSubmitting = false; }
      });
    } else {
      // Crear: sin matrícula, el backend la genera
      const data: CrearAlumno = {
        nombre:   this.form.value.nombre,
        grupo_id: Number(this.form.value.grupo_id)
      };
      this.studentsService.crearAlumno(data).subscribe({
        next: () => { this.sweetAlert.toast('Alumno creado', 'success'); this.cerrarModal(); this.cargarDatos(); this.isSubmitting = false; },
        error: () => { this.sweetAlert.error('Error', 'No se pudo crear el alumno'); this.isSubmitting = false; }
      });
    }
  }

  // ─── Eliminar ─────────────────────────────────────────────
  async eliminar(alumno: Alumno): Promise<void> {
    const result = await this.sweetAlert.confirmDelete(`¿Eliminar a ${alumno.nombre}?`);
    if (result.isConfirmed) {
      this.studentsService.eliminarAlumno(alumno.id).subscribe({
        next: () => { this.sweetAlert.toast('Alumno eliminado', 'success'); this.cargarDatos(); },
        error: () => this.sweetAlert.error('Error', 'No se pudo eliminar')
      });
    }
  }

  // ─── Excel ───────────────────────────────────────────────
  onArchivoExcel(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);
      this.alumnosExcel = rows.map(r => ({
        nombre:          r['nombre']          || r['Nombre']          || '',
        nivel_educativo: r['nivel_educativo'] || r['Nivel Educativo'] || r['nivel educativo'] || '',
        grado:           r['grado']           || r['Grado']           || '',
        grupo:           r['grupo']           || r['Grupo']           || ''
      })).filter(r => r.nombre && r.nivel_educativo && r.grado && r.grupo);
    };
    reader.readAsArrayBuffer(input.files[0]);
  }

  async importarExcel(): Promise<void> {
    if (!this.alumnosExcel.length) return;
    const result = await this.sweetAlert.confirm(`¿Importar ${this.alumnosExcel.length} alumnos?`, 'El sistema generará una matrícula única para cada uno');
    if (!result.isConfirmed) return;

    this.importando = true;
    this.sweetAlert.loading('Importando...', 'Creando alumnos y generando matrículas');
    let exitosos = 0, fallidos = 0;

    for (const alumno of this.alumnosExcel) {
      // 1. Nivel educativo
      const nivel = this.nivelesEducativos.find(
        ne => ne.nombre.toLowerCase() === alumno.nivel_educativo.toLowerCase()
      );
      if (!nivel) { fallidos++; continue; }

      // 2. Nivel académico (grado) dentro de ese nivel educativo
      const nivelAcad = this.nivelesAcademicos.find(
        na => na.nivel_educativo_id === nivel.id &&
              na.nombre.toLowerCase() === alumno.grado.toLowerCase()
      );
      if (!nivelAcad) { fallidos++; continue; }

      // 3. Grupo dentro de ese nivel académico
      const grupo = this.grupos.find(
        g => g.nivel_academico_id === nivelAcad.id &&
             g.nombre.toLowerCase() === alumno.grupo.toLowerCase()
      );
      if (!grupo) { fallidos++; continue; }

      try {
        await new Promise<void>((resolve, reject) => {
          this.studentsService.crearAlumno({ nombre: alumno.nombre, grupo_id: grupo.id })
            .subscribe({ next: () => resolve(), error: () => reject() });
        });
        exitosos++;
      } catch { fallidos++; }
    }

    this.sweetAlert.closeLoading();
    this.importando = false;
    this.alumnosExcel = [];

    if (fallidos === 0) {
      this.sweetAlert.success('¡Importación exitosa!', `${exitosos} alumnos creados con matrícula automática`);
    } else {
      this.sweetAlert.warning('Importación parcial', `${exitosos} creados, ${fallidos} fallaron (nivel no encontrado o sin grupos)`);
    }
    this.cargarDatos();
    this.cerrarModalExcel();
  }

  descargarPlantilla(): void {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['nombre', 'nivel_educativo', 'grado', 'grupo'],
      ['Juan Pérez García',      'Primaria',      '1°',  'A'],
      ['María García López',     'Secundaria',    '2°',  'B'],
      ['Carlos Ruiz Martínez',   'Preparatoria',  '3°', 'A'],
    ]);
    ws['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 15 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');
    XLSX.writeFile(wb, 'plantilla_alumnos.xlsx');
  }

  // ─── Cerrar modales ──────────────────────────────────────
  cerrarModal(): void {
    this.form.reset();
    this.modoEdicion = false;
    this.alumnoSeleccionado = null;
    this.nivelEducativoSeleccionado = null;
    this.nivelAcademicoSeleccionado = null;
    this.gruposSeleccionados = [];
    const modal = document.getElementById('modalAlumno');
    if (modal) (window as any).bootstrap.Modal.getInstance(modal)?.hide();
  }

  cerrarModalExcel(): void {
    this.alumnosExcel = [];
    const modal = document.getElementById('modalExcel');
    if (modal) (window as any).bootstrap.Modal.getInstance(modal)?.hide();
  }
}
