import { Component, HostListener, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';
import { QRCodeComponent } from 'angularx-qrcode';
import { AttendanceService } from '../../../core/services/attendance.service';
import { GroupsService } from '../../../core/services/groups.service';
import { GrupoMateriasService } from '../../../core/services/grupo-materias.service';
import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { AlumnoListaAsistencia, SesionAsistencia, EstadoAsistencia, MetodoAsistencia, CredencialQr } from '../../../core/models/attendance.model';
import { Grupo } from '../../../core/models/group.model';
import { GrupoMateria } from '../../../core/models/groupSubject.model';
import { Usuario } from '../../../core/models/user.model';
import { ESTADOS_ASISTENCIA } from '../../../core/constants/attendance.constants';
import { ORDEN_NIVELES_EDUCATIVOS } from '../../../core/constants/task.constants';
import { calcularResumenAsistencia, obtenerConfigEstado } from '../../../core/utils/attendance.utils';
import { obtenerNombreGrupo } from '../../../core/utils/task.utils';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-roll-call',
  imports: [ CommonModule, FormsModule, ZXingScannerModule, QRCodeComponent ],
  templateUrl: './roll-call.component.html',
  styleUrl: './roll-call.component.scss'
})
export class RollCallComponent implements OnInit {

  readonly estadosAsistencia = ESTADOS_ASISTENCIA;
  readonly obtenerConfigEstado = obtenerConfigEstado;
  readonly obtenerNombreGrupo = obtenerNombreGrupo;
  readonly formatosQr = [BarcodeFormat.QR_CODE];
  private readonly INTERVALO_MIN_ENTRE_ESCANEOS_MS = 3000;

  usuario: Usuario | null = null;
  grupos: Grupo[] = [];
  grupoMaterias: GrupoMateria[] = [];
  nivelActivo = '';
  isLoadingGrupos = true;

  private grupoIdDesdeRuta: number | null = null;

  modalAbierto = false;
  grupoSeleccionado: number | null = null;
  materiaSeleccionada: GrupoMateria | null = null;

  sesion: SesionAsistencia | null = null;
  alumnos: AlumnoListaAsistencia[] = [];
  metodoActivo: MetodoAsistencia = 'manual';

  isLoadingLista = false;
  guardandoAlumnoId: number | null = null;
  textoBusquedaAlumno = '';

  mostrarModalQr = false;
  isGuardandoQr = false;
  escaneoActivo = false;
  scannerError: string | null = null;
  tokenManualQr = '';
  private ultimoTokenEscaneado: string | null = null;
  private ultimoEscaneoTimestamp = 0;

  // Modal de credencial del alumno
  mostrarModalCredencial = false;
  alumnoCredencial: AlumnoListaAsistencia | null = null;
  credencialQr: CredencialQr | null = null;
  isLoadingCredencial = false;
  isRegenerandoCredencial = false;
  isExportandoCredencial = false;

  @ViewChild('qrcodeEl', { read: ElementRef }) qrcodeElRef?: ElementRef<HTMLElement>;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly attendanceService: AttendanceService,
    private readonly groupsService: GroupsService,
    private readonly grupoMateriasService: GrupoMateriasService,
    private readonly authService: AuthService,
    private readonly sweetAlert: SweetAlertService,
  ) {
    this.usuario = this.authService.getUsuario();
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('grupoId');
    this.grupoIdDesdeRuta = idParam ? Number(idParam) : null;
    this.cargarDatos();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.mostrarModalCredencial) {
      this.cerrarModalCredencial();
    } else if (this.mostrarModalQr) {
      this.cerrarModalQr();
    } else if (this.modalAbierto) {
      this.cerrarModal();
    }
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
        this.intentarAbrirGrupoDesdeRuta();
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

  private intentarAbrirGrupoDesdeRuta(): void {
    if (!this.grupoIdDesdeRuta || this.modalAbierto) return;
    const grupo = this.grupos.find(g => g.id === this.grupoIdDesdeRuta);
    if (!grupo) return;

    this.nivelActivo = grupo.nivel_educativo || this.nivelActivo;
    this.seleccionarGrupo(grupo);
    this.grupoIdDesdeRuta = null;
  }

  seleccionarNivel(nivel: string): void {
    this.nivelActivo = nivel;
  }

  seleccionarGrupo(grupo: Grupo): void {
    this.grupoSeleccionado = grupo.id;
    this.materiaSeleccionada = null;
    this.sesion = null;
    this.alumnos = [];
    this.textoBusquedaAlumno = '';
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.grupoSeleccionado = null;
    this.materiaSeleccionada = null;
    this.sesion = null;
    this.alumnos = [];

    if (this.route.snapshot.paramMap.has('grupoId')) {
      this.router.navigate(['/dashboard/roll-call']);
    }
  }

  seleccionarMateria(materia: GrupoMateria): void {
    this.materiaSeleccionada = materia;
    this.isLoadingLista = true;

    this.attendanceService.abrirSesion({ grupo_materia_id: materia.id }).subscribe({
      next: ({ sesion_id }) => this.cargarListaSesion(sesion_id),
      error: () => {
        this.sweetAlert.error('Error', 'No se pudo abrir el pase de lista');
        this.isLoadingLista = false;
        this.materiaSeleccionada = null;
      }
    });
  }

  private cargarListaSesion(sesionId: number): void {
    this.attendanceService.obtenerListaSesion(sesionId).subscribe({
      next: ({ sesion, alumnos }) => {
        this.sesion = sesion;
        this.alumnos = alumnos;
        this.metodoActivo = sesion.metodo_default;
        this.isLoadingLista = false;
      },
      error: () => {
        this.sweetAlert.error('Error', 'No se pudo cargar la lista de alumnos');
        this.isLoadingLista = false;
      }
    });
  }

  get alumnosFiltrados(): AlumnoListaAsistencia[] {
    const texto = this.textoBusquedaAlumno.trim().toLowerCase();
    if (!texto) return this.alumnos;
    return this.alumnos.filter(a =>
      a.alumno_nombre.toLowerCase().includes(texto) ||
      a.matricula.toLowerCase().includes(texto)
    );
  }

  get resumen() {
    return calcularResumenAsistencia(this.alumnos.map(a => a.estado));
  }

  get sesionCerrada(): boolean {
    return this.sesion?.cerrada ?? false;
  }

  cambiarMetodo(metodo: MetodoAsistencia): void {
    this.metodoActivo = metodo;
  }

  marcarEstado(alumno: AlumnoListaAsistencia, estado: EstadoAsistencia): void {
    if (!this.sesion || this.sesionCerrada || this.guardandoAlumnoId) return;

    const estadoAnterior = alumno.estado;
    alumno.estado = estado;
    this.guardandoAlumnoId = alumno.alumno_id;

    this.attendanceService.registrarManual({
      sesion_id: this.sesion.id,
      alumno_id: alumno.alumno_id,
      estado,
    }).subscribe({
      next: () => this.guardandoAlumnoId = null,
      error: () => {
        alumno.estado = estadoAnterior;
        this.guardandoAlumnoId = null;
        this.sweetAlert.error('Error', `No se pudo registrar la asistencia de ${alumno.alumno_nombre}`);
      }
    });
  }

  marcarTodosPresentes(): void {
    if (!this.sesion || this.sesionCerrada) return;
    this.alumnos.filter(a => a.estado === null).forEach(alumno => this.marcarEstado(alumno, 'presente'));
  }

  // Modo QR (escanear)
  abrirModalQr(): void {
    this.tokenManualQr = '';
    this.scannerError = null;
    this.ultimoTokenEscaneado = null;
    this.mostrarModalQr = true;
    this.escaneoActivo = true;
  }

  cerrarModalQr(): void {
    this.mostrarModalQr = false;
    this.escaneoActivo = false;
  }

  onScanSuccess(resultado: string): void {
    const ahora = Date.now();
    const esMismoTokenReciente =
      resultado === this.ultimoTokenEscaneado &&
      ahora - this.ultimoEscaneoTimestamp < this.INTERVALO_MIN_ENTRE_ESCANEOS_MS;

    if (esMismoTokenReciente) return;

    this.ultimoTokenEscaneado = resultado;
    this.ultimoEscaneoTimestamp = ahora;
    this.procesarTokenEscaneado(resultado);
  }

  onCamerasNotFound(): void {
    this.scannerError = 'No se encontró ninguna cámara disponible en este dispositivo.';
  }

  onPermissionResponse(permitido: boolean): void {
    this.scannerError = permitido
      ? null
      : 'No se otorgó permiso de cámara. Puedes ingresar el token manualmente.';
  }

  procesarTokenEscaneado(token: string): void {
    if (!this.sesion || this.sesionCerrada || !token.trim() || this.isGuardandoQr) return;

    this.isGuardandoQr = true;
    this.attendanceService.registrarQr({ sesion_id: this.sesion.id, token: token.trim() }).subscribe({
      next: (resultado) => {
        this.isGuardandoQr = false;
        this.actualizarAlumnoEnLista(resultado.alumno_id, resultado.estado);
        this.sweetAlert.toast(
          resultado.ya_estaba_registrado
            ? `${resultado.alumno_nombre} ya estaba registrado`
            : `${resultado.alumno_nombre} registrado como presente`,
          'success'
        );
        this.tokenManualQr = '';
      },
      error: (error) => {
        this.isGuardandoQr = false;
        const mensaje = error?.error?.message || 'No se pudo registrar la asistencia por QR';
        this.sweetAlert.error('Error', mensaje);
      }
    });
  }

  registrarTokenManual(): void {
    this.procesarTokenEscaneado(this.tokenManualQr);
  }

  private actualizarAlumnoEnLista(alumnoId: number, estado: EstadoAsistencia): void {
    const alumno = this.alumnos.find(a => a.alumno_id === alumnoId);
    if (alumno) alumno.estado = estado;
  }

  async cerrarSesion(): Promise<void> {
    if (!this.sesion) return;

    const result = await this.sweetAlert.confirm(
      '¿Cerrar el pase de lista?',
      'Ya no podrás editar los registros de esta sesión',
      'Sí, cerrar',
      'Cancelar'
    );
    if (!result.isConfirmed) return;

    this.attendanceService.cerrarSesion(this.sesion.id).subscribe({
      next: (sesion) => {
        this.sesion = sesion;
        this.sweetAlert.toast('Pase de lista cerrado', 'success');
      },
      error: () => this.sweetAlert.error('Error', 'No se pudo cerrar la sesión')
    });
  }

  // Modal de credencial (mostrar/imprimir el QR del alumno)
  verCredencial(alumno: AlumnoListaAsistencia): void {
    this.alumnoCredencial = alumno;
    this.credencialQr = null;
    this.isLoadingCredencial = true;
    this.mostrarModalCredencial = true;

    this.attendanceService.obtenerQrAlumno(alumno.alumno_id).subscribe({
      next: (data) => {
        this.credencialQr = data;
        this.isLoadingCredencial = false;
      },
      error: () => {
        this.isLoadingCredencial = false;
        this.sweetAlert.error('Error', 'No se pudo cargar la credencial del alumno');
      }
    });
  }

  cerrarModalCredencial(): void {
    this.mostrarModalCredencial = false;
    this.alumnoCredencial = null;
    this.credencialQr = null;
  }

  async regenerarCredencial(): Promise<void> {
    if (!this.alumnoCredencial || this.isRegenerandoCredencial) return;

    const result = await this.sweetAlert.confirm(
      '¿Regenerar credencial?',
      'El código QR actual dejará de funcionar y se generará uno nuevo',
      'Sí, regenerar',
      'Cancelar'
    );
    if (!result.isConfirmed) return;

    this.isRegenerandoCredencial = true;
    this.attendanceService.regenerarQrAlumno(this.alumnoCredencial.alumno_id).subscribe({
      next: (data) => {
        this.credencialQr = data;
        this.isRegenerandoCredencial = false;
        this.sweetAlert.toast('Credencial regenerada', 'success');
      },
      error: () => {
        this.isRegenerandoCredencial = false;
        this.sweetAlert.error('Error', 'No se pudo regenerar la credencial');
      }
    });
  }

  copiarToken(): void {
    if (!this.credencialQr) return;
    navigator.clipboard.writeText(this.credencialQr.token).then(() => {
      this.sweetAlert.toast('Código copiado', 'success');
    });
  }

  exportarCredencialPdf(): void {
    const canvas = this.qrcodeElRef?.nativeElement.querySelector('canvas');
    if (!this.credencialQr || !this.alumnoCredencial || !canvas || this.isExportandoCredencial) return;

    this.isExportandoCredencial = true;
    try {
      const doc = new jsPDF({ unit: 'mm', format: [90, 130] });
      const centroX = 45;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(this.alumnoCredencial.alumno_nombre, centroX, 15, { align: 'center', maxWidth: 80 });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(this.alumnoCredencial.matricula, centroX, 22, { align: 'center' });

      const qrDataUrl = (canvas as HTMLCanvasElement).toDataURL('image/png');
      doc.addImage(qrDataUrl, 'PNG', 15, 28, 60, 60);

      doc.setFontSize(7);
      doc.text('Código de respaldo:', centroX, 94, { align: 'center' });
      doc.setFont('courier', 'normal');
      doc.text(this.credencialQr.token, centroX, 99, { align: 'center', maxWidth: 80 });

      doc.save(`Credencial_${this.alumnoCredencial.matricula}.pdf`);
    } catch {
      this.sweetAlert.error('Error', 'No se pudo generar el PDF de la credencial');
    } finally {
      this.isExportandoCredencial = false;
    }
  }

}
