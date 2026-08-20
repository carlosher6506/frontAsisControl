import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { AttendanceService } from '../../../core/services/attendance.service';
import { GroupsService } from '../../../core/services/groups.service';
import { GrupoMateriasService } from '../../../core/services/grupo-materias.service';
import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { ReporteAsistenciaAlumno } from '../../../core/models/attendance.model';
import { Grupo } from '../../../core/models/group.model';
import { GrupoMateria } from '../../../core/models/groupSubject.model';
import { Usuario } from '../../../core/models/user.model';
import { ORDEN_NIVELES_EDUCATIVOS } from '../../../core/constants/task.constants';
import { obtenerClaseAsistencia } from '../../../core/utils/attendance.utils';
import { obtenerNombreGrupo } from '../../../core/utils/task.utils';
import { sanitizeFileName, sanitizeSheetName } from '../../../core/utils/ratings.utils';

@Component({
  selector: 'app-attendance-report',
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.scss'
})
export class AttendanceReportComponent implements OnInit {

  readonly obtenerNombreGrupo = obtenerNombreGrupo;
  readonly obtenerClaseAsistencia = obtenerClaseAsistencia;

  usuario: Usuario | null = null;
  grupos: Grupo[] = [];
  grupoMaterias: GrupoMateria[] = [];
  nivelActivo = '';
  isLoadingGrupos = true;

  modalAbierto = false;
  grupoSeleccionado: number | null = null;
  materiaSeleccionada: GrupoMateria | null = null;

  fechaInicio = '';
  fechaFin = '';
  reporte: ReporteAsistenciaAlumno[] = [];
  isLoadingReporte = false;
  isExportando = false;
  textoBusquedaAlumno = '';

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly groupsService: GroupsService,
    private readonly grupoMateriasService: GrupoMateriasService,
    private readonly authService: AuthService,
    private readonly sweetAlert: SweetAlertService,
  ) {
    this.usuario = this.authService.getUsuario();
  }

  ngOnInit(): void {
    this.fechaInicio = this.primerDiaDelMes();
    this.fechaFin = this.fechaHoy();
    this.cargarDatos();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modalAbierto) this.cerrarModal();
  }

  get esAdmin(): boolean {
    return this.usuario?.rol?.toLowerCase() === 'admin';
  }

  get gruposFiltrados(): Grupo[] {
    if (this.esAdmin) return this.grupos;
    const idsConMateria = new Set(
      this.grupoMaterias
        .filter(gm => gm.maestro_id === this.usuario?.id)
        .map(gm => gm.grupo_id)
    );
    return this.grupos.filter(g => idsConMateria.has(g.id));
  }

  get nivelesEducativos(): string[] {
    const niveles = [...new Set(this.gruposFiltrados.map(g => g.nivel_educativo).filter(Boolean))] as string[];
    return niveles.sort((a, b) => {
      const posA = ORDEN_NIVELES_EDUCATIVOS.indexOf(a as never);
      const posB = ORDEN_NIVELES_EDUCATIVOS.indexOf(b as never);
      const ordenA = posA === -1 ? Number.MAX_SAFE_INTEGER : posA;
      const ordenB = posB === -1 ? Number.MAX_SAFE_INTEGER : posB;
      return ordenA - ordenB || a.localeCompare(b);
    });
  }

  get gruposPorNivel(): Grupo[] {
    return this.gruposFiltrados.filter(g => g.nivel_educativo === this.nivelActivo);
  }

  get grupoActivo(): Grupo | null {
    return this.grupos.find(g => g.id === this.grupoSeleccionado) ?? null;
  }

  materiasDelGrupo(grupoId: number): GrupoMateria[] {
    return this.grupoMaterias
      .filter(gm => gm.grupo_id === grupoId)
      .filter(gm => this.esAdmin || gm.maestro_id === this.usuario?.id);
  }

  get materiasDelGrupoActivo(): GrupoMateria[] {
    return this.grupoSeleccionado ? this.materiasDelGrupo(this.grupoSeleccionado) : [];
  }

  private cargarDatos(): void {
    this.isLoadingGrupos = true;
    this.groupsService.obtenerGrupos().subscribe({
      next: (data) => {
        this.grupos = data;
        this.actualizarNivelActivo();
        this.isLoadingGrupos = false;
      },
      error: () => {
        this.sweetAlert.error('Error', 'No se pudieron cargar los grupos');
        this.isLoadingGrupos = false;
      }
    });

    this.grupoMateriasService.obtenerGrupoMaterias().subscribe({
      next: (data) => {
        this.grupoMaterias = data;
        this.actualizarNivelActivo();
      }
    });
  }

  private actualizarNivelActivo(): void {
    if (!this.nivelesEducativos.includes(this.nivelActivo)) {
      this.nivelActivo = this.nivelesEducativos[0] ?? '';
    }
  }

  seleccionarNivel(nivel: string): void {
    this.nivelActivo = nivel;
  }

  seleccionarGrupo(grupo: Grupo): void {
    this.grupoSeleccionado = grupo.id;
    this.materiaSeleccionada = null;
    this.reporte = [];
    this.textoBusquedaAlumno = '';
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.grupoSeleccionado = null;
    this.materiaSeleccionada = null;
    this.reporte = [];
  }

  seleccionarMateria(materia: GrupoMateria): void {
    this.materiaSeleccionada = materia;
    this.generarReporte();
  }

  generarReporte(): void {
    if (!this.materiaSeleccionada) return;

    if (!this.fechaInicio || !this.fechaFin) {
      this.sweetAlert.error('Rango incompleto', 'Selecciona la fecha de inicio y la fecha final');
      return;
    }
    if (this.fechaInicio > this.fechaFin) {
      this.sweetAlert.error('Rango inválido', 'La fecha de inicio no puede ser mayor a la fecha final');
      return;
    }

    this.isLoadingReporte = true;
    this.attendanceService.obtenerReporte(this.materiaSeleccionada.id, this.fechaInicio, this.fechaFin).subscribe({
      next: (data) => {
        this.reporte = data;
        this.isLoadingReporte = false;
      },
      error: () => {
        this.sweetAlert.error('Error', 'No se pudo generar el reporte de asistencia');
        this.isLoadingReporte = false;
      }
    });
  }

  get reporteFiltrado(): ReporteAsistenciaAlumno[] {
    const texto = this.textoBusquedaAlumno.trim().toLowerCase();
    if (!texto) return this.reporte;
    return this.reporte.filter(r =>
      r.alumno_nombre.toLowerCase().includes(texto) ||
      r.matricula.toLowerCase().includes(texto)
    );
  }

  get promedioAsistencia(): number {
    if (!this.reporte.length) return 0;
    const suma = this.reporte.reduce((acc, r) => acc + Number(r.porcentaje_asistencia || 0), 0);
    return Math.round((suma / this.reporte.length) * 10) / 10;
  }

  get alumnosEnRiesgo(): number {
    return this.reporte.filter(r => Number(r.porcentaje_asistencia) < 75).length;
  }

  exportarReporte(): void {
    if (!this.reporte.length || !this.materiaSeleccionada || this.isExportando) return;
    this.isExportando = true;

    try {
      const filas = this.reporte.map(r => ({
        'Alumno': r.alumno_nombre,
        'Matrícula': r.matricula,
        'Total sesiones': r.total_sesiones,
        'Presentes': r.presentes,
        'Retardos': r.retardos,
        'Justificados': r.justificados,
        'Ausentes': r.ausentes,
        '% Asistencia': r.porcentaje_asistencia,
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(filas);
      ws['!cols'] = [
        { wch: 32 }, { wch: 14 }, { wch: 15 }, { wch: 12 },
        { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 13 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(this.materiaSeleccionada.materia_nombre || 'Reporte'));

      const nombreGrupo = this.grupoActivo?.nombre || 'Grupo';
      const nombreArchivo = `Asistencia_${nombreGrupo}_${this.materiaSeleccionada.materia_nombre}_${this.fechaInicio}_a_${this.fechaFin}.xlsx`;
      XLSX.writeFile(wb, sanitizeFileName(nombreArchivo));

      this.sweetAlert.toast('Reporte exportado correctamente', 'success');
    } catch {
      this.sweetAlert.error('Error', 'No se pudo exportar el reporte');
    } finally {
      this.isExportando = false;
    }
  }

  private fechaHoy(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private primerDiaDelMes(): string {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
  }
}
