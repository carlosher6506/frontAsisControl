import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { StudentsService } from '../../../core/services/students.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { Alumno, CrearAlumno } from '../../../core/models/student.model';
import { EducationLevelsService } from '../../../core/services/education-levels.service';
import { NivelEducativo } from '../../../core/models/education-level.model';
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

  // ── Datos ──────────────────────────────────────────────────────────────────
  alumnos: Alumno[] = [];
  nivelesEducativos: NivelEducativo[] = [];

  // ── Estado UI ──────────────────────────────────────────────────────────────
  isLoading = true;
  isSubmitting = false;
  modoEdicion = false;
  mostrarFiltros = false;

  // ── Selección ──────────────────────────────────────────────────────────────
  alumnoSeleccionado: Alumno | null = null;
  nivelEducativoSeleccionado: number | null = null;

  // ── Búsqueda y filtros ─────────────────────────────────────────────────────
  textoBusqueda = '';
  tabActivo = '';
  filtroGrado: { [nivel: string]: string } = {};
  filtroGrupo: { [nivel: string]: string } = {};
  filtroCiclo: { [nivel: string]: string } = {};

  // ── Paginación ─────────────────────────────────────────────────────────────
  readonly pageSize = 15;
  private paginasPorNivel: Map<string, number> = new Map();

  // ── Excel ──────────────────────────────────────────────────────────────────
  alumnosExcel: { nombre: string; nivel_educativo: string }[] = [];
  importando = false;

  // ── Form ───────────────────────────────────────────────────────────────────
  form: FormGroup;

  constructor(
    private readonly studentsService: StudentsService,
    private readonly educationLevelsService: EducationLevelsService,
    private readonly sweetAlert: SweetAlertService,
    private readonly fb: FormBuilder,
  ) {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
    });
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  // ── Getters form ───────────────────────────────────────────────────────────
  get nombre() { return this.form.get('nombre')!; }

  // ── Niveles con alumnos (tabs) ─────────────────────────────────────────────
  get alumnosFiltrados(): Alumno[] {
    if (!this.textoBusqueda.trim()) return this.alumnos;
    const texto = this.textoBusqueda.toLowerCase();
    return this.alumnos.filter(a =>
      a.nombre.toLowerCase().includes(texto) ||
      a.matricula?.toLowerCase().includes(texto)
    );
  }

  get nivelesConAlumnos(): NivelConAlumnos[] {
    const mapa = new Map<string, Alumno[]>();
    for (const alumno of this.alumnosFiltrados) {
      const nivel = alumno.nivel_educativo?.trim() || 'Sin nivel';
      if (!mapa.has(nivel)) mapa.set(nivel, []);
      mapa.get(nivel)!.push(alumno);
    }
    return Array.from(mapa.entries()).map(([nombre, alumnos]) => ({ nombre, alumnos }));
  }

  // ── Búsqueda ───────────────────────────────────────────────────────────────
  onBusqueda(): void {
    this.paginasPorNivel.clear();
  }

  // ── Filtros ────────────────────────────────────────────────────────────────
  getGradosDeNivel(nivel: NivelConAlumnos): string[] {
    return [...new Set(nivel.alumnos.map(a => a.nivel_academico).filter(Boolean))];
  }

  getGruposDeNivel(nivel: NivelConAlumnos): string[] {
    let alumnos = nivel.alumnos;
    const grado = this.filtroGrado[nivel.nombre];
    if (grado) alumnos = alumnos.filter(a => a.nivel_academico === grado);
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

  getCiclosDeNivel(nivel: NivelConAlumnos): string[] {
    return [...new Set(nivel.alumnos.map(a => a.ciclo_escolar).filter(Boolean))];
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
    this.filtroGrado[nivel.nombre] = '';
    this.filtroGrupo[nivel.nombre] = '';
    this.filtroCiclo[nivel.nombre] = '';
    this.paginasPorNivel.clear();
  }

  tieneFiltrosActivos(nivel: NivelConAlumnos): boolean {
    return !!(this.filtroGrado[nivel.nombre] || this.filtroGrupo[nivel.nombre] || this.filtroCiclo[nivel.nombre]);
  }

  // ── Paginación ─────────────────────────────────────────────────────────────
  getPaginaActiva(nivel: NivelConAlumnos): number {
    return this.paginasPorNivel.get(nivel.nombre) ?? 1;
  }

  getTotalPaginasFiltradas(nivel: NivelConAlumnos): number {
    return Math.max(1, Math.ceil(this.getAlumnosFiltradosPorNivel(nivel).length / this.pageSize));
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

  getPaginaActualFiltrada(nivel: NivelConAlumnos): Alumno[] {
    const alumnos = this.getAlumnosFiltradosPorNivel(nivel);
    const pagina = this.getPaginaActiva(nivel);
    const inicio = (pagina - 1) * this.pageSize;
    return alumnos.slice(inicio, inicio + this.pageSize);
  }

  getPaginaInfoFiltrada(nivel: NivelConAlumnos): string {
    const alumnos = this.getAlumnosFiltradosPorNivel(nivel);
    const pagina = this.getPaginaActiva(nivel);
    const inicio = (pagina - 1) * this.pageSize + 1;
    const fin = Math.min(pagina * this.pageSize, alumnos.length);
    return `Mostrando ${inicio}–${fin} de ${alumnos.length}`;
  }

  cambiarPagina(nivel: NivelConAlumnos, pagina: number): void {
    const total = this.getTotalPaginasFiltradas(nivel);
    if (pagina < 1 || pagina > total) return;
    this.paginasPorNivel.set(nivel.nombre, pagina);
  }

  // ── Carga de datos ─────────────────────────────────────────────────────────
  cargarDatos(): void {
    this.isLoading = true;
    this.studentsService.obtenerAlumnos().subscribe({
      next: (data) => {
        this.alumnos = data;
        this.isLoading = false;
        if (this.nivelesConAlumnos.length > 0 && !this.tabActivo) {
          this.tabActivo = this.nivelesConAlumnos[0].nombre;
        }
      },
      error: () => {
        this.sweetAlert.error('Error', 'No se pudieron cargar los alumnos');
        this.isLoading = false;
      }
    });
    this.educationLevelsService.obtenerNiveles().subscribe({
      next: (data) => this.nivelesEducativos = data
    });
  }

  // ── Modal crear ────────────────────────────────────────────────────────────
  abrirModalCrear(): void {
    this.modoEdicion = false;
    this.alumnoSeleccionado = null;
    this.nivelEducativoSeleccionado = null;
    this.form.reset();
  }

  // ── Modal editar ───────────────────────────────────────────────────────────
  abrirModalEditar(alumno: Alumno): void {
    this.modoEdicion = true;
    this.alumnoSeleccionado = alumno;
    const nivel = this.nivelesEducativos.find(item =>
      item.nombre.trim().toLowerCase() === alumno.nivel_educativo?.trim().toLowerCase()
    );
    this.nivelEducativoSeleccionado = nivel?.id ?? null;
    this.form.patchValue({ nombre: alumno.nombre });
  }

  // ── Guardar ────────────────────────────────────────────────────────────────
  guardar(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.isSubmitting = true;

    if (this.modoEdicion && this.alumnoSeleccionado) {
      this.studentsService.actualizarAlumno(
        this.alumnoSeleccionado.id,
        {
          nombre: this.form.value.nombre,
          nivel_educativo_id: this.nivelEducativoSeleccionado === null
            ? null
            : Number(this.nivelEducativoSeleccionado)
        }
      ).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.sweetAlert.toast('Alumno actualizado', 'success');
          this.cerrarModal();
          this.cargarDatos();
        },
        error: () => {
          this.isSubmitting = false;
          this.sweetAlert.error('Error', 'No se pudo actualizar el alumno');
        }
      });
    } else {
      const data: CrearAlumno = {
        nombre: this.form.value.nombre,
        nivel_educativo_id: this.nivelEducativoSeleccionado === null
          ? undefined
          : Number(this.nivelEducativoSeleccionado),
      };
      this.studentsService.crearAlumno(data).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.sweetAlert.toast('Alumno creado', 'success');
          this.cerrarModal();
          this.cargarDatos();
        },
        error: () => {
          this.isSubmitting = false;
          this.sweetAlert.error('Error', 'No se pudo crear el alumno');
        }
      });
    }
  }

  // ── Eliminar ───────────────────────────────────────────────────────────────
  async eliminar(alumno: Alumno): Promise<void> {
    const result = await this.sweetAlert.confirmDelete(`¿Eliminar a ${alumno.nombre}?`);
    if (result.isConfirmed) {
      this.studentsService.eliminarAlumno(alumno.id).subscribe({
        next: () => {
          this.sweetAlert.toast('Alumno eliminado', 'success');
          this.cargarDatos();
        },
        error: () => this.sweetAlert.error('Error', 'No se pudo eliminar')
      });
    }
  }

  // ── Excel ──────────────────────────────────────────────────────────────────
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
        nivel_educativo: r['nivel_educativo'] || r['Nivel Educativo'] || '',
      })).filter(r => r.nombre);
    };
    reader.readAsArrayBuffer(input.files[0]);
  }

  async importarExcel(): Promise<void> {
    if (!this.alumnosExcel.length) return;
    const result = await this.sweetAlert.confirm(
      `¿Importar ${this.alumnosExcel.length} alumnos?`,
      'El sistema generará una matrícula única para cada uno'
    );
    if (!result.isConfirmed) return;

    this.importando = true;
    this.sweetAlert.loading('Importando...', 'Creando alumnos y generando matrículas');
    let exitosos = 0, fallidos = 0;

    for (const alumno of this.alumnosExcel) {
      const nivel = this.nivelesEducativos.find(
        ne => ne.nombre.toLowerCase() === alumno.nivel_educativo?.toLowerCase()
      );
      try {
        await new Promise<void>((resolve, reject) => {
          this.studentsService.crearAlumno({
            nombre: alumno.nombre,
            nivel_educativo_id: nivel?.id
          }).subscribe({ next: () => resolve(), error: () => reject() });
        });
        exitosos++;
      } catch { fallidos++; }
    }

    this.sweetAlert.closeLoading();
    this.importando = false;
    this.alumnosExcel = [];

    if (fallidos === 0) {
      this.sweetAlert.success('¡Importación exitosa!', `${exitosos} alumnos creados`);
    } else {
      this.sweetAlert.warning('Importación parcial', `${exitosos} creados, ${fallidos} fallaron`);
    }
    this.cargarDatos();
    this.cerrarModalExcel();
  }

  descargarPlantilla(): void {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['nombre', 'nivel_educativo'],
      ['Juan Pérez García',    'Primaria'],
      ['María García López',   'Secundaria'],
      ['Carlos Ruiz Martínez', 'Preparatoria'],
    ]);
    ws['!cols'] = [{ wch: 35 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');
    XLSX.writeFile(wb, 'plantilla_alumnos.xlsx');
  }

  // ── Cerrar modales ─────────────────────────────────────────────────────────
  cerrarModal(): void {
    this.form.reset();
    this.modoEdicion = false;
    this.alumnoSeleccionado = null;
    this.nivelEducativoSeleccionado = null;
    const modal = document.getElementById('modalAlumno');
    if (modal) (window as any).bootstrap.Modal.getInstance(modal)?.hide();
  }

  cerrarModalExcel(): void {
    this.alumnosExcel = [];
    const modal = document.getElementById('modalExcel');
    if (modal) (window as any).bootstrap.Modal.getInstance(modal)?.hide();
  }
}
