import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { RatingsService } from '../../../core/services/ratings.service';
import { GrupoMateriasService } from '../../../core/services/grupo-materias.service';
import { GroupsService } from '../../../core/services/groups.service';
import { StudentsService } from '../../../core/services/students.service';
import { EvaluationsService } from '../../../core/services/evaluations.service';
import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { Boleta, BoletaMateria, Calificacion, CalificarRequest } from '../../../core/models/rating.model';
import { GrupoMateria } from '../../../core/models/groupSubject.model';
import { Grupo } from '../../../core/models/group.model';
import { Alumno } from '../../../core/models/student.model';
import { ConfiguracionEvaluacion } from '../../../core/models/evaluation.model';
import { Usuario } from '../../../core/models/user.model';
import { calculatePeriodGrade, createRatingSnapshot, equivalenteEscalaDiez, formatTwoDecimals, hasRatingChanged,
  normalizeNullableNumber, RatingSnapshot, roundFinalGrade, roundTo, sanitizeFileName, sanitizeSheetName,
} from '../../../core/utils/ratings.utils';
import { buildRatingReportFragment } from '../../../core/utils/rating-report.template';
import { ORDEN_NIVELES_EDUCATIVOS } from '../../../core/constants/task.constants';
import { obtenerNombreGrupo } from '../../../core/utils/task.utils';

const PRIMARY_LEVEL = 'primaria';
const POINTS_GRADE_LIMIT = 100;
const STANDARD_GRADE_LIMIT = 10;
const STUDENTS_PER_PAGE = 6;

@Component({
  selector: 'app-ratings',
  imports: [CommonModule, FormsModule],
  templateUrl: './ratings.component.html',
  styleUrl: './ratings.component.scss',
})
export class RatingsComponent implements OnInit {
  grupos: Grupo[] = [];
  grupoMaterias: GrupoMateria[] = [];
  alumnos: Alumno[] = [];
  evaluaciones: ConfiguracionEvaluacion[] = [];
  calificaciones: Calificacion[] = [];
  usuario: Usuario | null = null;
  isLoading = false;
  isSaving = false;
  isLoadingBoleta = false;
  modalAbierto = false;
  paginaActual = 1;
  readonly elementosPorPagina = STUDENTS_PER_PAGE;
  grupoSeleccionado: number | null = null;
  grupoMateriaSeleccionado: GrupoMateria | null = null;
  alumnoSeleccionado: Alumno | null = null;
  periodoSeleccionado = 1;
  nivelActivo = '';
  private estadoInicial = new Map<number, RatingSnapshot>();

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
    if (this.modalAbierto) this.cerrarModal();
  }

  get esAdmin(): boolean {
    return this.usuario?.rol?.toLowerCase() === 'admin';
  }

  get esPorPuntos(): boolean {
    return this.configEvaluacion?.tipo_evaluacion === 'puntos';
  }

  get esPrimaria(): boolean {
    return (
      this.grupos
        .find((g) => g.id === Number(this.grupoSeleccionado))
        ?.nivel_educativo?.trim()
        .toLowerCase() === PRIMARY_LEVEL
    );
  }

  get usaEscalaCien(): boolean {
    return this.esPorPuntos;
  }

  get limiteCalificacion(): number {
    return this.usaEscalaCien ? POINTS_GRADE_LIMIT : STANDARD_GRADE_LIMIT;
  }

  get placeholderCalificacion(): string {
    return this.usaEscalaCien ? '0-100' : '0-10';
  }

  get gruposFiltrados(): Grupo[] {
    if (this.esAdmin) return this.grupos;
    const ids = this.grupoMaterias
      .filter((gm) => gm.maestro_id === this.usuario?.id)
      .map((gm) => gm.grupo_id);
    return this.grupos.filter((g) => ids.includes(g.id));
  }

  get gruposVisibles(): Grupo[] {
    return this.gruposFiltrados;
  }

  get nivelesEducativos(): string[] {
    const niveles = [
      ...new Set(this.gruposVisibles.map((grupo) => grupo.nivel_educativo).filter(Boolean)),
    ] as string[];
    return niveles.sort((a, b) => {
      const posicionA = ORDEN_NIVELES_EDUCATIVOS.indexOf(a as never);
      const posicionB = ORDEN_NIVELES_EDUCATIVOS.indexOf(b as never);
      const ordenA = posicionA === -1 ? Number.MAX_SAFE_INTEGER : posicionA;
      const ordenB = posicionB === -1 ? Number.MAX_SAFE_INTEGER : posicionB;
      return ordenA - ordenB || a.localeCompare(b);
    });
  }

  get gruposPorNivel(): Grupo[] {
    return this.gruposVisibles.filter((grupo) => grupo.nivel_educativo === this.nivelActivo);
  }

  get materiasFiltradas(): GrupoMateria[] {
    if (!this.grupoSeleccionado) return [];

    return this.materiasDelGrupo(this.grupoSeleccionado);
  }

  materiasDelGrupo(grupoId: number): GrupoMateria[] {
    return this.grupoMaterias
      .filter((gm) => gm.grupo_id === grupoId)
      .filter((gm) => this.esAdmin || gm.maestro_id === this.usuario?.id);
  }

  get alumnosFiltrados(): Alumno[] {
    return this.alumnos;
  }

  get configEvaluacion(): ConfiguracionEvaluacion | null {
    return this.evaluaciones.find((e) => e.grupo_id === Number(this.grupoSeleccionado)) ?? null;
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

  get calificacionesPeriodo(): Calificacion[] {
    return this.calificaciones.filter((c) => c.periodo === this.periodoSeleccionado);
  }

  get alumnosPaginados(): Alumno[] {
    return this.alumnosFiltrados.slice(
      (this.paginaActual - 1) * this.elementosPorPagina,
      this.paginaActual * this.elementosPorPagina,
    );
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.alumnosFiltrados.length / this.elementosPorPagina));
  }

  get hayCambiosPeriodo(): boolean {
    return this.calificacionesPeriodo.some((cal) => this.estaModificada(cal));
  }

  get numeroCambiosPeriodo(): number {
    return this.calificacionesPeriodo.filter((cal) => this.estaModificada(cal)).length;
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

  getNombreCompletoGrupo(grupo: Grupo): string {
    return `${grupo.nivel_educativo || ''} ${grupo.nivel_academico || ''} ${grupo.nombre}`.trim();
  }

  obtenerNombreGrupo(grupo: Grupo): string {
    return obtenerNombreGrupo(grupo);
  }

  seleccionarNivel(nivel: string): void {
    this.nivelActivo = nivel;
  }

  seleccionarGrupo(grupo: Grupo): void {
    this.grupoSeleccionado = grupo.id;
    this.grupoMateriaSeleccionado = null;
    this.alumnoSeleccionado = null;
    this.periodoSeleccionado = 1;
    this.limpiarCalificaciones();
    this.modalAbierto = true;

    this.studentsService.obtenerAlumnosPorGrupo(grupo.id).subscribe({
      next: (data) => (this.alumnos = data),
      error: () => this.sweetAlert.error('Error', 'No se pudieron cargar los alumnos.'),
    });
  }

  seleccionarMateria(materia: GrupoMateria): void {
    this.onMateriaChange(materia.id);
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.grupoMateriaSeleccionado = null;
    this.alumnoSeleccionado = null;
    this.limpiarCalificaciones();
  }

  onGrupoChange(): void {
    this.grupoMateriaSeleccionado = null;
    this.alumnoSeleccionado = null;
    this.limpiarCalificaciones();
    this.periodoSeleccionado = 1;
    this.paginaActual = 1;
    if (this.grupoSeleccionado)
      this.studentsService.obtenerAlumnosPorGrupo(Number(this.grupoSeleccionado)).subscribe({
        next: (data) => (this.alumnos = data),
        error: () => this.sweetAlert.error('Error', 'No se pudieron cargar los alumnos'),
      });
    else this.alumnos = [];
  }

  onMateriaChange(id: number): void {
    this.grupoMateriaSeleccionado =
      this.materiasFiltradas.find((gm) => gm.id === Number(id)) ?? null;
    this.alumnoSeleccionado = null;
    this.limpiarCalificaciones();
    this.periodoSeleccionado = 1;
  }

  seleccionarAlumno(alumno: Alumno): void {
    this.alumnoSeleccionado = alumno;
    this.cargarCalificaciones();
  }

  seleccionarPeriodo(periodo: number): void {
    this.periodoSeleccionado = periodo;
  }

  cargarCalificaciones(): void {
    if (!this.alumnoSeleccionado || !this.grupoMateriaSeleccionado) return;
    this.isLoading = true;
    this.ratingsService
      .obtenerCalificacionesPorAlumno(this.alumnoSeleccionado.id, this.grupoMateriaSeleccionado.id)
      .subscribe({
        next: (data) => {
          this.calificaciones = data;
          this.crearEstadoInicial();
          this.isLoading = false;
        },
        error: () => {
          this.sweetAlert.error('Error', 'No se pudieron cargar las calificaciones');
          this.isLoading = false;
        },
      });
  }

  onCalificacionChange(cal: Calificacion): void {
    if (cal.calificacion === null || cal.calificacion === undefined) {
      cal.calificacion = null;
      cal.puntos_obtenidos = this.esPorPuntos ? null : cal.puntos_obtenidos;
      return;
    }
    cal.calificacion = this.normalizarNumero(cal.calificacion);
    if (this.esPorPuntos)
      cal.puntos_obtenidos = this.redondear(
        (cal.calificacion / POINTS_GRADE_LIMIT) * (Number(cal.valor_tarea) || 0),
      );
  }

  estaModificada(cal: Calificacion): boolean {
    return hasRatingChanged(cal, this.estadoInicial);
  }

  guardarCalificacion(cal: Calificacion): void {
    if (!this.alumnoSeleccionado || !this.validarCalificacion(cal)) return;
    if (!this.estaModificada(cal)) {
      this.sweetAlert.toast('No hay cambios por guardar', 'info');
      return;
    }
    this.guardar(cal)
      .then(() => this.sweetAlert.toast('Calificación guardada', 'success'))
      .catch(() => this.sweetAlert.error('Error', 'No se pudo guardar la calificación'));
  }
  async guardarTodo(): Promise<void> {
    if (!this.alumnoSeleccionado) return;
    const modificadas = this.calificacionesPeriodo.filter((cal) => this.estaModificada(cal));
    if (!modificadas.length) {
      this.sweetAlert.toast('No hay cambios por guardar', 'info');
      return;
    }
    if (modificadas.some((cal) => !this.validarCalificacion(cal))) return;
    const result = await this.sweetAlert.confirm(
      '¿Guardar cambios?',
      `Se guardarán únicamente ${modificadas.length} calificación(es) modificada(s).`,
    );
    if (!result.isConfirmed) return;
    this.isSaving = true;
    this.sweetAlert.loading('Guardando cambios...', 'Por favor espera');
    const resultados = await Promise.allSettled(modificadas.map((cal) => this.guardar(cal)));
    this.isSaving = false;
    this.sweetAlert.closeLoading();
    const exitosas = resultados.filter((r) => r.status === 'fulfilled').length;
    const fallidas = resultados.length - exitosas;
    if (fallidas)
      this.sweetAlert.warning(
        'Guardado parcial',
        `${exitosas} guardadas; ${fallidas} no pudieron guardarse.`,
      );
    else
      this.sweetAlert.success('Cambios guardados', `${exitosas} calificación(es) actualizada(s).`);
  }

  getTotalPuntos(): number {
    return this.calificacionesPeriodo.reduce((s, c) => s + (Number(c.puntos_obtenidos) || 0), 0);
  }

  getMaxPuntosPeriodo(): number {
    return this.calificacionesPeriodo.reduce((s, c) => s + (Number(c.valor_tarea) || 0), 0);
  }

  getCalificacionPeriodo(): number {
    return this.calcularPeriodo(this.calificacionesPeriodo);
  }

  getCalificacionRedondeada(valor = this.getCalificacionPeriodo()): number {
    return roundFinalGrade(valor);
  }

  formatearDosDecimales(valor: number): string {
    return formatTwoDecimals(valor);
  }

  equivalenteDiez(valor: number | null | undefined): string | null {
    return equivalenteEscalaDiez(valor, this.usaEscalaCien);
  }

  async exportarBoletaPdf(): Promise<void> {
    if (!this.alumnoSeleccionado || this.isLoadingBoleta) return;
    this.isLoadingBoleta = true;
    this.ratingsService.obtenerBoleta(this.alumnoSeleccionado.id).subscribe({
      next: async (boleta) => {
        try {
          await this.generarPdfBoleta(boleta);
        } catch {
          this.sweetAlert.error('Error', 'No se pudo generar el PDF de la boleta');
        } finally {
          this.isLoadingBoleta = false;
        }
      },
      error: () => {
        this.isLoadingBoleta = false;
        this.sweetAlert.error('Error', 'No se pudo generar la boleta');
      },
    });
  }

  calcularCalificacionFinal(item: BoletaMateria): number {
    const base =
      item.tipo_evaluacion === 'promedio'
        ? Number(item.promedio_calificaciones) || 0
        : (Number(item.total_puntos_posibles) || 0) > 0
          ? ((Number(item.total_puntos_obtenidos) || 0) / Number(item.total_puntos_posibles)) * 10
          : 0;
    return this.getCalificacionRedondeada(base);
  }

  paginaAnterior(): void {
    if (this.paginaActual > 1) this.paginaActual--;
  }

  paginaSiguiente(): void {
    if (this.paginaActual < this.totalPaginas) this.paginaActual++;
  }

  async exportarCalificaciones(): Promise<void> {
    if (!this.grupoMateriaSeleccionado || !this.configEvaluacion) return;
    this.sweetAlert.loading('Generando concentrado...', 'Cargando calificaciones por alumno');
    try {
      const resultados = await Promise.all(
        this.alumnosFiltrados.map(async (alumno) => ({
          alumno,
          calificaciones: await firstValueFrom(
            this.ratingsService.obtenerCalificacionesPorAlumno(
              alumno.id,
              this.grupoMateriaSeleccionado!.id,
            ),
          ),
        })),
      );
      const tareas = this.obtenerTareasOrdenadas(resultados.flatMap((r) => r.calificaciones));
      const encabezados = [
        'Alumno',
        ...tareas.map((t) => `${this.nombrePeriodo} ${t.periodo} · ${t.tarea_nombre}`),
        ...this.periodos.map((p) => `${this.nombrePeriodo} ${p} final`),
        'Promedio final',
      ];
      const filas = resultados.map(({ alumno, calificaciones }) => {
        const fila: Record<string, string | number> = { Alumno: alumno.nombre };
        tareas.forEach((tarea) => {
          const calificacion = calificaciones.find((c) => c.tarea_id === tarea.tarea_id);
          fila[`${this.nombrePeriodo} ${tarea.periodo} · ${tarea.tarea_nombre}`] =
            calificacion?.calificacion ?? '';
        });
        const porPeriodo = this.periodos.map((periodo) =>
          this.calcularPeriodo(calificaciones.filter((c) => c.periodo === periodo)),
        );
        this.periodos.forEach(
          (periodo, index) =>
            (fila[`${this.nombrePeriodo} ${periodo} final`] = this.getCalificacionRedondeada(
              porPeriodo[index],
            )),
        );
        const conDatos = porPeriodo.filter((valor) => valor > 0);
        fila['Promedio final'] = conDatos.length
          ? this.getCalificacionRedondeada(conDatos.reduce((s, v) => s + v, 0) / conDatos.length)
          : 0;
        return fila;
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(filas, { header: encabezados });
      ws['!cols'] = encabezados.map((header, index) => ({
        wch: index === 0 ? 32 : Math.min(Math.max(header.length + 2, 13), 28),
      }));
      XLSX.utils.book_append_sheet(
        wb,
        ws,
        this.nombreHojaSeguro(this.grupoMateriaSeleccionado.materia_nombre || 'Concentrado'),
      );
      const grupo = this.grupos.find((g) => g.id === this.grupoSeleccionado);
      XLSX.writeFile(
        wb,
        this.nombreArchivoSeguro(
          `Concentrado_${grupo?.nombre || 'Grupo'}_${this.grupoMateriaSeleccionado.materia_nombre || 'Materia'}.xlsx`,
        ),
      );
      this.sweetAlert.toast('Concentrado generado correctamente', 'success');
    } catch {
      this.sweetAlert.error('Error', 'No se pudo generar el concentrado');
    } finally {
      this.sweetAlert.closeLoading();
    }
  }

  private async guardar(cal: Calificacion): Promise<void> {
    const request: CalificarRequest = {
      alumno_id: this.alumnoSeleccionado!.id,
      tarea_id: cal.tarea_id,
      calificacion: this.normalizarNumeroNulo(cal.calificacion),
      puntos_obtenidos: this.esPorPuntos ? this.normalizarNumeroNulo(cal.puntos_obtenidos) : null,
    };
    await firstValueFrom(this.ratingsService.calificar(request));
    this.estadoInicial.set(cal.tarea_id, {
      calificacion: request.calificacion,
      puntosObtenidos: request.puntos_obtenidos ?? null,
    });
  }

  private validarCalificacion(cal: Calificacion): boolean {
    if (cal.calificacion === null) return true;
    const valor = Number(cal.calificacion);
    if (!Number.isFinite(valor) || valor < 0 || valor > this.limiteCalificacion) {
      this.sweetAlert.error(
        'Calificación inválida',
        `Captura un valor entre 0 y ${this.limiteCalificacion}.`,
      );
      return false;
    }
    return true;
  }

  private crearEstadoInicial(): void {
    this.estadoInicial = createRatingSnapshot(this.calificaciones);
  }

  private limpiarCalificaciones(): void {
    this.calificaciones = [];
    this.estadoInicial.clear();
  }

  private actualizarNivelActivo(): void {
    if (!this.nivelesEducativos.includes(this.nivelActivo)) {
      this.nivelActivo = this.nivelesEducativos[0] ?? '';
    }
  }
  private normalizarNumero(valor: number | null): number {
    return roundTo(Number(valor));
  }

  private normalizarNumeroNulo(valor: number | null | undefined): number | null {
    return normalizeNullableNumber(valor);
  }

  private redondear(valor: number): number {
    return roundTo(valor);
  }

  private calcularPeriodo(calificaciones: Calificacion[]): number {
    return calculatePeriodGrade(calificaciones, this.esPorPuntos);
  }

  private obtenerTareasOrdenadas(calificaciones: Calificacion[]): Calificacion[] {
    return [...new Map(calificaciones.map((cal) => [cal.tarea_id, cal])).values()].sort(
      (a, b) =>
        (a.periodo || 0) - (b.periodo || 0) ||
        (a.fecha || '').localeCompare(b.fecha || '') ||
        (a.tarea_nombre || '').localeCompare(b.tarea_nombre || ''),
    );
  }

  private nombreArchivoSeguro(nombre: string): string {
    return sanitizeFileName(nombre);
  }

  private nombreHojaSeguro(nombre: string): string {
    return sanitizeSheetName(nombre);
  }

  private async generarPdfBoleta(boleta: Boleta): Promise<void> {
    const contenedor = document.createElement('div');
    contenedor.style.position = 'fixed';
    contenedor.style.top = '0';
    contenedor.style.left = '-10000px';
    contenedor.style.zIndex = '-1';
    contenedor.innerHTML = buildRatingReportFragment(boleta, (item) =>
      this.calcularCalificacionFinal(item),
    );
    document.body.appendChild(contenedor);

    try {
      const hoja = contenedor.querySelector<HTMLElement>('.sheet');
      if (!hoja) throw new Error('No se pudo preparar la boleta para exportar');

      const canvas = await html2canvas(hoja, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL('image/png');

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(this.nombreArchivoSeguro(`Boleta_${boleta.alumno.nombre || 'Alumno'}.pdf`));
    } finally {
      document.body.removeChild(contenedor);
    }
  }
}
