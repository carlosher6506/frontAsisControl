import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RatingsService } from '../../../core/services/ratings.service';
import { GrupoMateriasService } from '../../../core/services/grupo-materias.service';
import { GroupsService } from '../../../core/services/groups.service';
import { StudentsService } from '../../../core/services/students.service';
import { EvaluationsService } from '../../../core/services/evaluations.service';
import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { Calificacion, CalificarRequest, Boleta } from '../../../core/models/rating.model';
import { GrupoMateria } from '../../../core/models/groupSubject.model';
import { Grupo } from '../../../core/models/group.model';
import { Alumno } from '../../../core/models/student.model';
import { ConfiguracionEvaluacion } from '../../../core/models/evaluation.model';
import { Usuario } from '../../../core/models/user.model';

@Component({
  selector: 'app-ratings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ratings.component.html',
  styleUrl: './ratings.component.scss'
})
export class RatingsComponent implements OnInit {

  grupos: Grupo[] = [];
  grupoMaterias: GrupoMateria[] = [];
  alumnos: Alumno[] = [];
  evaluaciones: ConfiguracionEvaluacion[] = [];
  calificaciones: Calificacion[] = [];
  boleta: Boleta | null = null;
  usuario: Usuario | null = null;

  isLoading = false;
  isSaving = false;
  isLoadingBoleta = false;
  mostrarBoleta = false;

  grupoSeleccionado: number | null = null;
  grupoMateriaSeleccionado: GrupoMateria | null = null;
  alumnoSeleccionado: Alumno | null = null;
  periodoSeleccionado: number = 1;

  constructor(
    private ratingsService: RatingsService,
    private grupoMateriasService: GrupoMateriasService,
    private groupsService: GroupsService,
    private studentsService: StudentsService,
    private evaluationsService: EvaluationsService,
    private authService: AuthService,
    private sweetAlert: SweetAlertService
  ) {
    this.usuario = this.authService.getUsuario();
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
    const gruposConMaterias = this.grupoMaterias
      .filter(gm => gm.maestro_id === this.usuario?.id)
      .map(gm => gm.grupo_id);
    return this.grupos.filter(g => gruposConMaterias.includes(g.id));
  }

  get materiasFiltradas(): GrupoMateria[] {
    if (!this.grupoSeleccionado) return [];
    const materias = this.grupoMaterias.filter(
      gm => gm.grupo_id === Number(this.grupoSeleccionado)
    );
    if (!this.esAdmin) {
      return materias.filter(gm => gm.maestro_id === this.usuario?.id);
    }
    return materias;
  }

  get alumnosFiltrados(): Alumno[] {
    if (!this.grupoSeleccionado) return [];
    return this.alumnos.filter(a => a.grupo_id === Number(this.grupoSeleccionado));
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

  get calificacionesPeriodo(): Calificacion[] {
    return this.calificaciones.filter(c => c.periodo === this.periodoSeleccionado);
  }

  // ── Cargar ─────────────────────────────────────────────────────
  cargarDatos(): void {
    this.groupsService.obtenerGrupos().subscribe({
      next: (data) => this.grupos = data
    });
    this.grupoMateriasService.obtenerGrupoMaterias().subscribe({
      next: (data) => this.grupoMaterias = data
    });
    this.evaluationsService.obtenerEvaluaciones().subscribe({
      next: (data) => this.evaluaciones = data
    });
    this.studentsService.obtenerAlumnos().subscribe({
      next: (data) => this.alumnos = data
    });
  }

  // ── Helpers ────────────────────────────────────────────────────
  getNombreCompletoGrupo(grupo: Grupo): string {
    return `${grupo.nivel_educativo || ''} ${grupo.nivel_academico || ''} ${grupo.nombre}`.trim();
  }

  // Convierte calificación 0-100 a puntos obtenidos
  onCalificacionChange(cal: Calificacion): void {
    if (!this.esPorPuntos || cal.calificacion === null) return;
    const valorTarea = Number(cal.valor_tarea) || 0;
    cal.puntos_obtenidos = Math.round((cal.calificacion / 100) * valorTarea * 100) / 100;
  }

  getTotalPuntos(): number {
    return this.calificacionesPeriodo
      .reduce((sum, c) => sum + (Number(c.puntos_obtenidos) || 0), 0);
  }

  getMaxPuntosPeriodo(): number {
    return this.calificacionesPeriodo
      .reduce((sum, c) => sum + (Number(c.valor_tarea) || 0), 0);
  }

  // Calificación final del periodo (0-10)
  getCalificacionFinal(): number {
    const max = this.getMaxPuntosPeriodo();
    if (max === 0) return 0;
    return Math.round((this.getTotalPuntos() / max) * 10 * 10) / 10;
  }

  // ── Cambios ────────────────────────────────────────────────────
  onGrupoChange(): void {
    this.grupoMateriaSeleccionado = null;
    this.alumnoSeleccionado = null;
    this.calificaciones = [];
    this.periodoSeleccionado = 1;
    this.mostrarBoleta = false;
    this.boleta = null;
  }

  onMateriaChange(id: number): void {
    this.grupoMateriaSeleccionado = this.materiasFiltradas.find(gm => gm.id === Number(id)) || null;
    this.alumnoSeleccionado = null;
    this.calificaciones = [];
    this.periodoSeleccionado = 1;
    this.mostrarBoleta = false;
  }

  seleccionarAlumno(alumno: Alumno): void {
    this.alumnoSeleccionado = alumno;
    this.mostrarBoleta = false;
    this.boleta = null;
    this.cargarCalificaciones();
  }

  seleccionarPeriodo(p: number): void {
    this.periodoSeleccionado = p;
  }

  // ── Cargar calificaciones ──────────────────────────────────────
  cargarCalificaciones(): void {
    if (!this.alumnoSeleccionado || !this.grupoMateriaSeleccionado) return;
    this.isLoading = true;

    this.ratingsService.obtenerCalificacionesPorAlumno(
      this.alumnoSeleccionado.id,
      this.grupoMateriaSeleccionado.id
    ).subscribe({
      next: (data) => { this.calificaciones = data; this.isLoading = false; },
      error: () => { this.sweetAlert.error('Error', 'No se pudieron cargar las calificaciones'); this.isLoading = false; }
    });
  }

  // ── Guardar calificación ───────────────────────────────────────
  guardarCalificacion(cal: Calificacion): void {
    console.log('cal completo:', cal);
    if (!this.alumnoSeleccionado) return;

    const data: CalificarRequest = {
      alumno_id:        this.alumnoSeleccionado.id,
      tarea_id:         cal.tarea_id,
      calificacion:     cal.calificacion,
      puntos_obtenidos: this.esPorPuntos ? cal.puntos_obtenidos : null
    };

    this.ratingsService.calificar(data).subscribe({
      next: () => {
        this.sweetAlert.toast('Calificación guardada', 'success');
        this.cargarCalificaciones(); // ← solo recarga las calificaciones del alumno
      },
      error: () => this.sweetAlert.error('Error', 'No se pudo guardar')
    });
  }

  // Guarda todas las calificaciones del periodo de una vez
  async guardarTodo(): Promise<void> {
    if (!this.alumnoSeleccionado) return;

    const result = await this.sweetAlert.confirm(
      '¿Guardar todas las calificaciones?',
      `Se guardarán ${this.calificacionesPeriodo.length} calificaciones del ${this.nombrePeriodo} ${this.periodoSeleccionado}`
    );

    if (!result.isConfirmed) return;

    this.isSaving = true;
    this.sweetAlert.loading('Guardando...', 'Por favor espera');

    let exitosos = 0;
    let fallidos = 0;

    for (const cal of this.calificacionesPeriodo) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.ratingsService.calificar({
            alumno_id:        this.alumnoSeleccionado!.id,
            tarea_id:         cal.tarea_id,
            calificacion:     cal.calificacion,
            puntos_obtenidos: this.esPorPuntos ? cal.puntos_obtenidos : null
          }).subscribe({ next: () => resolve(), error: () => reject() });
        });
        exitosos++;
      } catch { fallidos++; }
    }

    this.sweetAlert.closeLoading();
    this.isSaving = false;

    if (fallidos === 0) {
      this.sweetAlert.success('¡Guardado!', `${exitosos} calificaciones guardadas correctamente`);
    } else {
      this.sweetAlert.warning('Guardado parcial', `${exitosos} guardadas, ${fallidos} fallaron`);
    }

    // Solo recarga las calificaciones del alumno actual, no todo
    this.cargarCalificaciones();
  }

  // ── Boleta ─────────────────────────────────────────────────────
  verBoleta(): void {
    if (!this.alumnoSeleccionado) return;
    this.isLoadingBoleta = true;
    this.mostrarBoleta = true;

    this.ratingsService.obtenerBoleta(this.alumnoSeleccionado.id).subscribe({
      next: (data) => { this.boleta = data; this.isLoadingBoleta = false; },
      error: () => { this.sweetAlert.error('Error', 'No se pudo generar la boleta'); this.isLoadingBoleta = false; }
    });
  }

  cerrarBoleta(): void {
    this.mostrarBoleta = false;
    this.boleta = null;
  }

  imprimirBoleta(): void {
    const contenido = document.getElementById('boleta')?.innerHTML;
    if (!contenido) return;

    const ventana = window.open('', '_blank', 'width=800,height=600');
    if (!ventana) return;

    ventana.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Boleta — ${this.boleta?.alumno.nombre}</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
        <style>
          body { padding: 20px; font-family: Arial, sans-serif; }
          .no-print { display: none !important; }
          @media print {
            body { padding: 10px; }
          }
        </style>
      </head>
      <body>
        ${contenido}
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); }
          }
        </script>
      </body>
      </html>
    `);

    ventana.document.close();
  }

  // Calificación final calculada para la boleta
  calcularCalificacionFinal(item: any): number {
    let calificacion: number;

    if (item.tipo_evaluacion === 'promedio') {
      calificacion = Number(item.promedio_calificaciones) || 0;
    } else {
      const obtenidos = Number(item.total_puntos_obtenidos) || 0;
      const posibles  = Number(item.total_puntos_posibles)  || 0;
      if (posibles === 0) return 0;
      calificacion = (obtenidos / posibles) * 10;
    }

    // Redondeo correcto: .5 sube, debajo de 6 → 5
    const redondeado = Math.round(calificacion * 10) / 10;

    // Si está entre 0 y 5.9 (exclusive) → 5
    if (redondeado > 0 && redondeado < 6) return 5;

    // Redondeo al entero más cercano para la calificación final
    return Math.round(redondeado);
  }

  getBadgeCalificacion(cal: number, minimo: number): string {
    return cal >= minimo ? 'bg-success' : 'bg-danger';
  }

  // Agrupa calificaciones de boleta por materia
  get materiasUnicas(): string[] {
    if (!this.boleta) return [];
    return [...new Set(this.boleta.calificaciones.map(c => c.materia_nombre))];
  }

  getCalificacionesPorMateria(materia: string): any[] {
    if (!this.boleta) return [];
    return this.boleta.calificaciones.filter(c => c.materia_nombre === materia);
  }
}
