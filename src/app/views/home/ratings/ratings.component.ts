import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, firstValueFrom, from, map, mergeMap, of, toArray } from 'rxjs';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { RatingsService } from '../../../core/services/ratings.service';
import { GrupoMateriasService } from '../../../core/services/grupo-materias.service';
import { GroupsService } from '../../../core/services/groups.service';
import { StudentsService } from '../../../core/services/students.service';
import { EvaluationsService } from '../../../core/services/evaluations.service';
import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import {
  Boleta,
  BoletaMateria,
  Calificacion,
  CalificarRequest,
} from '../../../core/models/rating.model';
import { GrupoMateria } from '../../../core/models/groupSubject.model';
import { Grupo } from '../../../core/models/group.model';
import { Alumno } from '../../../core/models/student.model';
import { ConfiguracionEvaluacion } from '../../../core/models/evaluation.model';
import { Usuario } from '../../../core/models/user.model';
import {
  calculatePeriodGrade,
  formatTwoDecimals,
  hasRatingChanged,
  normalizeNullableNumber,
  roundFinalGrade,
  roundTo,
  sanitizeFileName,
} from '../../../core/utils/ratings.utils';
import {
  completeRatingGridRow,
  createRatingGridRow,
  groupRatingTasks,
  ratingForRequest,
  ratingFromApi,
  RatingGridRow,
  RatingTaskGroup,
  sortRatingTasks,
} from '../../../core/utils/ratings-grid.utils';
import {
  buildRatingReportPages,
  RatingReportContext,
} from '../../../core/utils/rating-report.template';
import { ORDEN_NIVELES_EDUCATIVOS } from '../../../core/constants/task.constants';
import { obtenerNombreGrupo } from '../../../core/utils/task.utils';
import {
  buildRatingConcentrado,
  downloadRatingConcentrado,
} from '../../../core/utils/rating-concentrado.utils';

const REQUEST_CONCURRENCY = 5;

@Component({
  selector: 'app-ratings',
  imports: [CommonModule, FormsModule],
  templateUrl: './ratings.component.html',
  styleUrl: './ratings.component.scss',
})
export class RatingsComponent implements OnInit {
  readonly obtenerNombreGrupo = obtenerNombreGrupo;
  readonly formatearDosDecimales = formatTwoDecimals;
  readonly getCalificacionRedondeada = roundFinalGrade;
  grupos: Grupo[] = [];
  grupoMaterias: GrupoMateria[] = [];
  alumnos: Alumno[] = [];
  evaluaciones: ConfiguracionEvaluacion[] = [];
  filas: RatingGridRow[] = [];
  tareas: Calificacion[] = [];
  gruposTareas: RatingTaskGroup[] = [];
  gruposTareasVisibles: RatingTaskGroup[] = [];
  tareasVisibles: Calificacion[] = [];
  usuario: Usuario | null = null;
  isLoading = false;
  isLoadingAlumnos = false;
  errorCargaAlumnos = false;
  isSaving = false;
  isExportando = false;
  isExportandoBoletas = false;
  progresoBoletas = '';
  modalAbierto = false;
  grupoSeleccionado: number | null = null;
  grupoMateriaSeleccionado: GrupoMateria | null = null;
  periodoSeleccionado = 1;
  nivelActivo = '';
  textoBusquedaAlumno = '';
  etiquetaSeleccionada = '';
  private revisionCarga = 0;

  constructor(
    private readonly ratingsService: RatingsService,
    private readonly grupoMateriasService: GrupoMateriasService,
    private readonly groupsService: GroupsService,
    private readonly studentsService: StudentsService,
    private readonly evaluationsService: EvaluationsService,
    private readonly authService: AuthService,
    private readonly sweetAlert: SweetAlertService,
  ) {
    this.usuario = this.authService.getUsuario();
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modalAbierto) void this.cerrarModal();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.totalCambios) event.preventDefault();
  }

  get esAdmin(): boolean {
    return this.usuario?.rol?.toLowerCase() === 'admin';
  }
  get esPorPuntos(): boolean {
    return this.configEvaluacion?.tipo_evaluacion === 'puntos';
  }
  get esPrimaria(): boolean {
    return this.grupoActivo?.nivel_educativo?.trim().toLowerCase() === 'primaria';
  }
  get usaEscalaCien(): boolean {
    return this.esPorPuntos || this.esPrimaria;
  }
  get limiteCalificacion(): number {
    return this.usaEscalaCien ? 100 : 10;
  }

  get gruposFiltrados(): Grupo[] {
    if (this.esAdmin) return this.grupos;
    const ids = new Set(
      this.grupoMaterias
        .filter((gm) => gm.maestro_id === this.usuario?.id)
        .map((gm) => gm.grupo_id),
    );
    return this.grupos.filter((grupo) => ids.has(grupo.id));
  }

  get nivelesEducativos(): string[] {
    const niveles = [
      ...new Set(this.gruposFiltrados.map((grupo) => grupo.nivel_educativo).filter(Boolean)),
    ] as string[];
    return niveles.sort((a, b) => {
      const posA = ORDEN_NIVELES_EDUCATIVOS.indexOf(a as never);
      const posB = ORDEN_NIVELES_EDUCATIVOS.indexOf(b as never);
      return (posA < 0 ? 99 : posA) - (posB < 0 ? 99 : posB) || a.localeCompare(b);
    });
  }

  get gruposPorNivel(): Grupo[] {
    return this.gruposFiltrados.filter((grupo) => grupo.nivel_educativo === this.nivelActivo);
  }
  get materiasFiltradas(): GrupoMateria[] {
    return this.grupoSeleccionado ? this.materiasDelGrupo(this.grupoSeleccionado) : [];
  }

  materiasDelGrupo(grupoId: number): GrupoMateria[] {
    return this.grupoMaterias
      .filter((gm) => gm.grupo_id === grupoId)
      .filter((gm) => this.esAdmin || gm.maestro_id === this.usuario?.id);
  }

  get configEvaluacion(): ConfiguracionEvaluacion | null {
    return (
      this.evaluaciones.find((evaluacion) => evaluacion.grupo_id === this.grupoSeleccionado) ?? null
    );
  }

  get grupoActivo(): Grupo | null {
    return this.grupos.find((grupo) => grupo.id === this.grupoSeleccionado) ?? null;
  }
  get periodos(): number[] {
    return Array.from({ length: this.configEvaluacion?.num_periodos ?? 1 }, (_, i) => i + 1);
  }
  get nombrePeriodo(): string {
    return this.configEvaluacion?.tipo_periodo === 'trimestre' ? 'Trimestre' : 'Parcial';
  }

  get filasFiltradas(): RatingGridRow[] {
    const texto = this.textoBusquedaAlumno.trim().toLocaleLowerCase('es');
    return texto
      ? this.filas.filter(
          (fila) =>
            fila.alumno.nombre.toLocaleLowerCase('es').includes(texto) ||
            (fila.alumno.matricula || '').toLowerCase().includes(texto),
        )
      : this.filas;
  }

  get numeroCambiosPeriodo(): number {
    return this.cambiosDelPeriodo().length;
  }
  get totalCambios(): number {
    return this.filas.reduce(
      (total, fila) =>
        total + fila.calificaciones.filter((cal) => this.estaModificada(fila, cal)).length,
      0,
    );
  }
  get erroresCarga(): number {
    return this.filas.filter((fila) => fila.errorCarga).length;
  }

  cargarDatos(): void {
    this.groupsService.obtenerGrupos().subscribe({
      next: (data) => {
        this.grupos = data;
        this.actualizarNivelActivo();
      },
    });
    this.grupoMateriasService.obtenerGrupoMaterias().subscribe({
      next: (data) => {
        this.grupoMaterias = data;
        this.actualizarNivelActivo();
      },
    });
    this.evaluationsService
      .obtenerEvaluaciones()
      .subscribe({ next: (data) => (this.evaluaciones = data) });
  }

  seleccionarNivel(nivel: string): void {
    this.nivelActivo = nivel;
  }

  async seleccionarGrupo(grupo: Grupo): Promise<void> {
    if (this.isSaving || !(await this.confirmarDescartarCambios())) return;
    this.grupoSeleccionado = grupo.id;
    this.grupoMateriaSeleccionado = null;
    this.periodoSeleccionado = 1;
    this.alumnos = [];
    this.textoBusquedaAlumno = '';
    this.limpiarTabla();
    this.modalAbierto = true;
    await this.cargarAlumnos();
  }

  async cargarAlumnos(): Promise<void> {
    if (!this.grupoSeleccionado) return;
    const grupoId = this.grupoSeleccionado;
    const revision = this.revisionCarga;
    this.isLoadingAlumnos = true;
    this.errorCargaAlumnos = false;
    try {
      const alumnos = await firstValueFrom(this.studentsService.obtenerAlumnosPorGrupo(grupoId));
      if (revision !== this.revisionCarga) return;
      this.alumnos = [...new Map(alumnos.map((alumno) => [alumno.id, alumno])).values()].sort(
        (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
      );
    } catch {
      if (revision === this.revisionCarga) this.errorCargaAlumnos = true;
    } finally {
      if (revision === this.revisionCarga) this.isLoadingAlumnos = false;
    }
  }

  async seleccionarMateria(materia: GrupoMateria): Promise<void> {
    if (
      this.isSaving ||
      this.isLoadingAlumnos ||
      materia.id === this.grupoMateriaSeleccionado?.id ||
      !(await this.confirmarDescartarCambios())
    )
      return;
    this.grupoMateriaSeleccionado = materia;
    this.periodoSeleccionado = 1;
    this.textoBusquedaAlumno = '';
    this.limpiarTabla();
    await this.cargarCalificaciones();
  }

  async cerrarModal(): Promise<void> {
    if (this.isSaving || !(await this.confirmarDescartarCambios())) return;
    this.modalAbierto = false;
    this.grupoMateriaSeleccionado = null;
    this.grupoSeleccionado = null;
    this.isLoadingAlumnos = false;
    this.limpiarTabla();
  }

  seleccionarPeriodo(periodo: number): void {
    if (this.isSaving) return;
    this.periodoSeleccionado = periodo;
    this.etiquetaSeleccionada = '';
    this.actualizarColumnas();
  }

  filtrarEtiqueta(): void {
    this.gruposTareasVisibles = this.etiquetaSeleccionada
      ? this.gruposTareas.filter((grupo) => grupo.clave === this.etiquetaSeleccionada)
      : this.gruposTareas;
    this.tareasVisibles = this.gruposTareasVisibles.flatMap((grupo) => grupo.tareas);
  }

  async cargarCalificaciones(): Promise<void> {
    if (!this.grupoMateriaSeleccionado || !this.alumnos.length) return;
    const materiaId = this.grupoMateriaSeleccionado.id;
    const revision = ++this.revisionCarga;
    const escalaCien = this.usaEscalaCien;
    this.isLoading = true;
    try {
      const filas = await firstValueFrom(
        from(this.alumnos).pipe(
          mergeMap(
            (alumno) =>
              this.ratingsService.obtenerCalificacionesPorAlumno(alumno.id, materiaId).pipe(
                map((ratings) => createRatingGridRow(alumno, ratings, escalaCien)),
                catchError(() => of(createRatingGridRow(alumno, [], escalaCien, true))),
              ),
            REQUEST_CONCURRENCY,
          ),
          toArray(),
        ),
      );
      if (revision !== this.revisionCarga) return;
      this.filas = filas.sort((a, b) =>
        a.alumno.nombre.localeCompare(b.alumno.nombre, 'es', { sensitivity: 'base' }),
      );
      this.reconstruirTareas();
    } finally {
      if (revision === this.revisionCarga) this.isLoading = false;
    }
  }

  async reintentarAlumno(fila: RatingGridRow): Promise<void> {
    if (!this.grupoMateriaSeleccionado || fila.cargando || this.isSaving) return;
    const materiaId = this.grupoMateriaSeleccionado.id;
    const revision = this.revisionCarga;
    fila.cargando = true;
    try {
      const ratings = await firstValueFrom(
        this.ratingsService.obtenerCalificacionesPorAlumno(fila.alumno.id, materiaId),
      );
      if (revision !== this.revisionCarga) return;
      Object.assign(fila, createRatingGridRow(fila.alumno, ratings, this.usaEscalaCien));
      this.reconstruirTareas();
    } catch {
      if (revision === this.revisionCarga)
        this.sweetAlert.error(
          'Error',
          'No se pudieron cargar las calificaciones de ' + fila.alumno.nombre + '.',
        );
    } finally {
      fila.cargando = false;
    }
  }

  onCalificacionChange(cal: Calificacion): void {
    cal.calificacion = normalizeNullableNumber(cal.calificacion);
    if (this.esPorPuntos)
      cal.puntos_obtenidos =
        cal.calificacion === null
          ? null
          : roundTo((cal.calificacion / 100) * (Number(cal.valor_tarea) || 0));
  }

  estaModificada(fila: RatingGridRow, cal: Calificacion): boolean {
    return hasRatingChanged(cal, fila.estadoInicial);
  }
  esInvalida(cal: Calificacion): boolean {
    return (
      cal.calificacion !== null &&
      (!Number.isFinite(Number(cal.calificacion)) ||
        Number(cal.calificacion) < 0 ||
        Number(cal.calificacion) > this.limiteCalificacion)
    );
  }

  getCalificacionPeriodo(fila: RatingGridRow): number {
    return this.calcularPeriodo(
      fila.calificaciones.filter((cal) => (cal.periodo ?? 1) === this.periodoSeleccionado),
    );
  }

  getTotalPuntos(fila: RatingGridRow): number {
    return fila.calificaciones
      .filter((cal) => (cal.periodo ?? 1) === this.periodoSeleccionado)
      .reduce((total, cal) => total + (Number(cal.puntos_obtenidos) || 0), 0);
  }

  getMaxPuntosPeriodo(): number {
    return this.tareas
      .filter((cal) => (cal.periodo ?? 1) === this.periodoSeleccionado)
      .reduce((total, cal) => total + (Number(cal.valor_tarea) || 0), 0);
  }

  async guardarTodo(): Promise<void> {
    if (this.isSaving || this.isExportandoBoletas) return;
    const modificadas = this.cambiosDelPeriodo();
    if (!modificadas.length) return;
    const invalida = modificadas.find(({ cal }) => this.esInvalida(cal));
    if (invalida) {
      this.sweetAlert.error(
        'Calificación inválida',
        invalida.fila.alumno.nombre +
          ': captura un valor entre 0 y ' +
          this.limiteCalificacion +
          ' en ' +
          invalida.cal.tarea_nombre +
          '.',
      );
      return;
    }
    const result = await this.sweetAlert.confirm(
      '¿Guardar cambios?',
      'Se guardarán ' +
        modificadas.length +
        ' calificación(es) de ' +
        this.nombrePeriodo.toLowerCase() +
        ' ' +
        this.periodoSeleccionado +
        ', incluyendo las ocultas por los filtros.',
    );
    if (!result.isConfirmed) return;
    this.isSaving = true;
    try {
      const resultados = await firstValueFrom(
        from(modificadas).pipe(
          mergeMap(
            ({ fila, cal }) =>
              from(this.guardar(fila, cal)).pipe(
                map(() => true),
                catchError(() => of(false)),
              ),
            REQUEST_CONCURRENCY,
          ),
          toArray(),
        ),
      );
      const exitosas = resultados.filter(Boolean).length;
      const fallidas = resultados.length - exitosas;
      if (fallidas)
        this.sweetAlert.warning(
          'Guardado parcial',
          exitosas +
            ' guardadas; ' +
            fallidas +
            ' pendientes. Puedes reintentar sin perder los cambios.',
        );
      else this.sweetAlert.toast(exitosas + ' calificación(es) guardada(s)', 'success');
    } finally {
      this.isSaving = false;
    }
  }

  async exportarBoletasGrupo(): Promise<void> {
    if (
      this.isExportandoBoletas ||
      this.isSaving ||
      this.isLoadingAlumnos ||
      !this.grupoActivo ||
      !this.alumnos.length
    )
      return;
    if (this.totalCambios) {
      const result = await this.sweetAlert.confirm(
        'Hay calificaciones sin guardar',
        'Las boletas incluyen únicamente las calificaciones guardadas. ¿Continuar con la exportación?',
        'Exportar guardadas',
        'Cancelar',
      );
      if (!result.isConfirmed) return;
    }
    const alumnos = [...this.alumnos];
    const grupo = { ...this.grupoActivo };
    const context: RatingReportContext = {
      grupoNombre: grupo.nombre,
      nivelAcademico: grupo.nivel_academico,
      nivelEducativo: grupo.nivel_educativo,
      cicloEscolar: grupo.ciclo_escolar,
      tipoPeriodo: this.configEvaluacion?.tipo_periodo,
      numeroPeriodos: this.configEvaluacion?.num_periodos,
    };
    this.isExportandoBoletas = true;
    this.progresoBoletas = 'Cargando boletas...';
    try {
      const reportes = await firstValueFrom(
        from(alumnos).pipe(
          mergeMap(
            (alumno) =>
              this.ratingsService.obtenerBoleta(alumno.id).pipe(
                map((boleta) => ({
                  orden: alumnos.findIndex((a) => a.id === alumno.id),
                  boleta,
                })),
              ),
            REQUEST_CONCURRENCY,
          ),
          toArray(),
        ),
      );
      reportes.sort((a, b) => a.orden - b.orden);
      await this.generarPdfBoletas(
        reportes.map(({ boleta }) => boleta),
        context,
        sanitizeFileName('Boletas_' + obtenerNombreGrupo(grupo) + '.pdf'),
      );
      this.sweetAlert.toast(alumnos.length + ' boleta(s) exportada(s)', 'success');
    } catch {
      this.sweetAlert.error(
        'Error',
        'No se pudo generar el PDF completo del grupo. No se descargó un archivo parcial; intenta nuevamente.',
      );
    } finally {
      this.isExportandoBoletas = false;
      this.progresoBoletas = '';
    }
  }

  calcularCalificacionFinal(item: BoletaMateria): number {
    const base =
      item.tipo_evaluacion === 'promedio'
        ? Number(item.promedio_calificaciones) || 0
        : (Number(item.total_puntos_posibles) || 0) > 0
          ? ((Number(item.total_puntos_obtenidos) || 0) / Number(item.total_puntos_posibles)) * 10
          : 0;
    return roundFinalGrade(base);
  }

  async exportarCalificaciones(): Promise<void> {
    if (
      !this.grupoMateriaSeleccionado ||
      !this.configEvaluacion ||
      this.isExportando ||
      this.isSaving ||
      !this.alumnos.length
    )
      return;
    const materia = this.grupoMateriaSeleccionado;
    const config = this.configEvaluacion;
    const escalaCien = this.usaEscalaCien;
    const nombreGrupo = this.grupoActivo?.nombre || 'Grupo';
    const nombreGrupoCompleto = this.grupoActivo ? obtenerNombreGrupo(this.grupoActivo) : nombreGrupo;
    const nombrePeriodo = this.nombrePeriodo;
    this.isExportando = true;
    try {
      // El archivo incluye las notas guardadas; los borradores permanecen en la tabla.
      const resultados = await firstValueFrom(
        from(this.alumnos).pipe(
          mergeMap(
            (alumno) =>
              this.ratingsService.obtenerCalificacionesPorAlumno(alumno.id, materia.id).pipe(
                map((ratings) => ({
                  alumno,
                  calificaciones: ratings.map((cal) => ratingFromApi(cal, escalaCien)),
                })),
              ),
            REQUEST_CONCURRENCY,
          ),
          toArray(),
        ),
      );
      resultados.sort((a, b) => a.alumno.nombre.localeCompare(b.alumno.nombre, 'es'));
      const tareas = sortRatingTasks(resultados.flatMap((r) => r.calificaciones));
      const periodos = Array.from({ length: config.num_periodos }, (_, i) => i + 1);
      const filas = resultados.map(({ alumno, calificaciones }) => {
        const porPeriodo = periodos.map((periodo) => {
          const ratings = calificaciones.filter((cal) => (cal.periodo ?? 1) === periodo);
          return {
            conDatos: ratings.some((cal) => cal.calificacion !== null),
            valor: this.calcularPeriodo(ratings, config.tipo_evaluacion === 'puntos', escalaCien),
          };
        });
        const conDatos = porPeriodo.filter((periodo) => periodo.conDatos);
        return [
          alumno.nombre,
          alumno.matricula,
          ...tareas.map(
            (tarea) =>
              calificaciones.find((cal) => cal.tarea_id === tarea.tarea_id)?.calificacion ?? '',
          ),
          ...porPeriodo.map((periodo) => (periodo.conDatos ? roundFinalGrade(periodo.valor) : '')),
          conDatos.length
            ? roundFinalGrade(
                conDatos.reduce((sum, periodo) => sum + periodo.valor, 0) / conDatos.length,
              )
            : '',
        ];
      });
      const wb = buildRatingConcentrado(filas, tareas, periodos, {
        materia: materia.materia_nombre || 'Materia',
        grupo: nombreGrupoCompleto,
        nombrePeriodo,
        escalaCaptura: escalaCien ? 100 : 10,
      });
      downloadRatingConcentrado(
        wb,
        sanitizeFileName(
          'Concentrado_' + nombreGrupo + '_' + (materia.materia_nombre || 'Materia') + '.xlsx',
        ),
      );
      this.sweetAlert.toast('Concentrado de calificaciones guardadas generado', 'success');
    } catch {
      this.sweetAlert.error(
        'Error',
        'No se pudo generar el concentrado completo. Intenta nuevamente.',
      );
    } finally {
      this.isExportando = false;
    }
  }

  private async guardar(fila: RatingGridRow, cal: Calificacion): Promise<void> {
    const request: CalificarRequest = {
      alumno_id: fila.alumno.id,
      tarea_id: cal.tarea_id,
      calificacion: ratingForRequest(cal.calificacion, this.usaEscalaCien),
      puntos_obtenidos: this.esPorPuntos ? normalizeNullableNumber(cal.puntos_obtenidos) : null,
    };
    const guardada = ratingFromApi(
      await firstValueFrom(this.ratingsService.calificar(request)),
      this.usaEscalaCien,
    );
    cal.id = guardada.id;
    cal.calificacion = guardada.calificacion;
    cal.puntos_obtenidos = guardada.puntos_obtenidos;
    fila.estadoInicial.set(cal.tarea_id, {
      calificacion: cal.calificacion,
      puntosObtenidos: cal.puntos_obtenidos,
    });
  }

  private cambiosDelPeriodo(): { fila: RatingGridRow; cal: Calificacion }[] {
    return this.filas.flatMap((fila) =>
      fila.calificaciones
        .filter(
          (cal) =>
            (cal.periodo ?? 1) === this.periodoSeleccionado && this.estaModificada(fila, cal),
        )
        .map((cal) => ({ fila, cal })),
    );
  }

  private reconstruirTareas(): void {
    this.tareas = sortRatingTasks(this.filas.flatMap((fila) => fila.calificaciones));
    this.filas.forEach((fila) => completeRatingGridRow(fila, this.tareas));
    this.actualizarColumnas();
  }

  private actualizarColumnas(): void {
    this.gruposTareas = groupRatingTasks(this.tareas, this.periodoSeleccionado);
    if (!this.gruposTareas.some((grupo) => grupo.clave === this.etiquetaSeleccionada))
      this.etiquetaSeleccionada = '';
    this.filtrarEtiqueta();
  }

  private limpiarTabla(): void {
    this.revisionCarga++;
    this.filas = [];
    this.tareas = [];
    this.gruposTareas = [];
    this.gruposTareasVisibles = [];
    this.tareasVisibles = [];
    this.etiquetaSeleccionada = '';
    this.isLoading = false;
  }

  private async confirmarDescartarCambios(): Promise<boolean> {
    if (!this.totalCambios) return true;
    const result = await this.sweetAlert.confirm(
      'Hay calificaciones sin guardar',
      'Se perderán ' + this.totalCambios + ' cambio(s) pendiente(s).',
      'Descartar y continuar',
      'Seguir calificando',
    );
    return result.isConfirmed;
  }

  private actualizarNivelActivo(): void {
    if (!this.nivelesEducativos.includes(this.nivelActivo))
      this.nivelActivo = this.nivelesEducativos[0] ?? '';
  }

  private calcularPeriodo(
    calificaciones: Calificacion[],
    porPuntos = this.esPorPuntos,
    escalaCien = this.usaEscalaCien,
  ): number {
    return calculatePeriodGrade(
      calificaciones.map((cal) => ({
        ...cal,
        calificacion:
          cal.calificacion === null ? null : Number(cal.calificacion) / (escalaCien ? 10 : 1),
      })),
      porPuntos,
    );
  }

  private async generarPdfBoletas(
    boletas: Boleta[],
    context: RatingReportContext,
    nombreArchivo: string,
  ): Promise<void> {
    const contenedor = document.createElement('div');
    contenedor.style.position = 'fixed';
    contenedor.style.top = '0';
    contenedor.style.left = '-10000px';
    contenedor.style.zIndex = '-1';
    document.body.appendChild(contenedor);

    try {
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      let pagina = 0;
      for (const [index, boleta] of boletas.entries()) {
        this.progresoBoletas = 'Generando ' + (index + 1) + ' de ' + boletas.length + '...';
        for (const fragmento of buildRatingReportPages(
          boleta,
          (item) => this.calcularCalificacionFinal(item),
          context,
        )) {
          contenedor.innerHTML = fragmento;
          const hoja = contenedor.querySelector<HTMLElement>('.sheet');
          if (!hoja) throw new Error('No se pudo preparar la boleta para exportar');
          await Promise.all(Array.from(hoja.querySelectorAll('img'), (imagen) => imagen.decode()));
          const canvas = await html2canvas(hoja, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
          });
          const escala = Math.min((pdfWidth - 20) / canvas.width, (pdfHeight - 20) / canvas.height);
          const ancho = canvas.width * escala;
          const alto = canvas.height * escala;
          if (pagina++) pdf.addPage();
          pdf.addImage(
            canvas.toDataURL('image/png'),
            'PNG',
            (pdfWidth - ancho) / 2,
            10,
            ancho,
            alto,
            undefined,
            'FAST',
          );
          canvas.width = 0;
          canvas.height = 0;
        }
      }
      pdf.save(nombreArchivo);
    } finally {
      document.body.removeChild(contenedor);
    }
  }
}
