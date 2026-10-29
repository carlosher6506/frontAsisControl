import { Component, HostListener, OnDestroy, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';
import { QRCodeComponent } from 'angularx-qrcode';
import { catchError, concatMap, finalize, firstValueFrom, from, map, Observable, of, Subscription, switchMap, tap } from 'rxjs';
import { AttendanceService } from '../../../core/services/attendance.service';
import { GroupsService } from '../../../core/services/groups.service';
import { GrupoMateriasService } from '../../../core/services/grupo-materias.service';
import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { AlumnoListaAsistencia, SesionAsistencia, EstadoAsistencia, MetodoAsistencia, CredencialQr, ListaAsistenciaResponse } from '../../../core/models/attendance.model';
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
export class RollCallComponent implements OnInit, OnDestroy {

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
  fechaPaseSeleccionada = this.obtenerFechaLocalActual();

  sesion: SesionAsistencia | null = null;
  alumnos: AlumnoListaAsistencia[] = [];
  metodoActivo: MetodoAsistencia = 'manual';
  mostrarHistorial = false;
  cargandoHistorial = false;
  sesionesHistoricas: SesionAsistencia[] = [];

  isLoadingLista = false;
  guardandoAlumnoId: number | null = null;
  guardandoPendientes = false;
  cerrandoSesion = false;
  textoBusquedaAlumno = '';
  private cargaLista?: Subscription;
  private cargaHistorial?: Subscription;
  private guardado?: Subscription;
  private revisionCarga = 0;
  private destruido = false;

  mostrarModalQr = false;
  isGuardandoQr = false;
  escaneoActivo = false;
  solicitandoPermisoCamara = false;
  scannerError: string | null = null;
  camaraSeleccionada: MediaDeviceInfo | undefined;
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

  ngOnDestroy(): void {
    this.destruido = true;
    this.revisionCarga++;
    this.cargaLista?.unsubscribe();
    this.cargaHistorial?.unsubscribe();
    this.guardado?.unsubscribe();
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

  get fechaMaximaPase(): string {
    return this.obtenerFechaLocalActual();
  }

  get fechaPaseValida(): boolean {
    const fecha = this.fechaPaseSeleccionada;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return false;
    const dia = new Date(`${fecha}T00:00:00Z`);
    return Number.isFinite(dia.getTime()) && dia.toISOString().slice(0, 10) === fecha &&
      fecha <= this.fechaMaximaPase;
  }

  get fechaPaseTexto(): string {
    const fecha = this.sesion?.fecha.slice(0, 10) || this.fechaPaseSeleccionada;
    return /^\d{4}-\d{2}-\d{2}$/.test(fecha || '')
      ? fecha.split('-').reverse().join('/') : 'Fecha sin seleccionar';
  }

  get guardandoSesion(): boolean {
    return this.guardandoAlumnoId !== null || this.guardandoPendientes || this.isGuardandoQr || this.cerrandoSesion;
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
    if (this.guardandoSesion) return;
    this.limpiarPase();
    this.grupoSeleccionado = grupo.id;
    this.materiaSeleccionada = null;
    this.sesion = null;
    this.alumnos = [];
    this.mostrarHistorial = false;
    this.sesionesHistoricas = [];
    this.textoBusquedaAlumno = '';
    this.fechaPaseSeleccionada = this.obtenerFechaLocalActual();
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    if (this.guardandoSesion) return;
    this.limpiarPase();
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
    if (this.guardandoSesion) return;
    this.limpiarPase();
    this.materiaSeleccionada = materia;
  }

  cambiarFechaPase(): void {
    if (this.guardandoSesion) return;
    this.limpiarPase();
  }

  private limpiarPase(): void {
    this.revisionCarga++;
    this.cargaLista?.unsubscribe();
    this.cerrarHistorial();
    this.cerrarModalQr();
    this.sesion = null;
    this.alumnos = [];
    this.sesionesHistoricas = [];
    this.textoBusquedaAlumno = '';
    this.isLoadingLista = false;
  }

  abrirSesionParaFecha(): void {
    if (!this.materiaSeleccionada || this.isLoadingLista || this.guardandoSesion) return;
    if (!this.fechaPaseValida) {
      this.sweetAlert.error('Fecha inválida', 'Selecciona una fecha válida, hoy o anterior.');
      return;
    }
    const materiaId = this.materiaSeleccionada.id;
    const fecha = this.fechaPaseSeleccionada;
    this.limpiarPase();
    const solicitud = this.attendanceService.abrirSesion({ grupo_materia_id: materiaId, fecha }).pipe(
      switchMap(({ sesion_id }) => this.attendanceService.obtenerListaSesion(sesion_id).pipe(
        map(respuesta => {
          if (respuesta.sesion.id !== sesion_id) throw new Error('La sesión recibida no corresponde al pase solicitado');
          return respuesta;
        })
      ))
    );
    this.cargarListaSesion(solicitud, materiaId, fecha);
  }

  private cargarListaSesion(solicitud: Observable<ListaAsistenciaResponse>, materiaId: number, fecha: string): void {
    const revision = this.revisionCarga;
    this.isLoadingLista = true;
    this.cargaLista = solicitud.subscribe({
      next: ({ sesion, alumnos }) => {
        if (revision !== this.revisionCarga) return;
        this.isLoadingLista = false;
        if (sesion.grupo_materia_id !== materiaId || sesion.fecha.slice(0, 10) !== fecha) {
          this.sweetAlert.error('Pase incorrecto', 'No se cargó el pase porque su fecha o materia no coincide con tu selección. Vuelve a abrirlo.');
          return;
        }
        this.sesion = sesion;
        this.alumnos = alumnos;
        this.metodoActivo = sesion.metodo_default;
      },
      error: error => {
        if (revision !== this.revisionCarga) return;
        this.sweetAlert.error('Error', error?.error?.message || 'No se pudo abrir el pase de la fecha seleccionada. Inténtalo de nuevo.');
        this.isLoadingLista = false;
      }
    });
  }

  abrirHistorial(): void {
    if (!this.materiaSeleccionada || this.cargandoHistorial || this.guardandoSesion || this.isLoadingLista) return;
    const materiaId = this.materiaSeleccionada.id;
    const revision = this.revisionCarga;
    this.mostrarHistorial = true;
    this.cargandoHistorial = true;
    this.cargaHistorial = this.attendanceService.obtenerSesiones(materiaId).subscribe({
      next: (sesiones) => {
        if (revision !== this.revisionCarga) return;
        this.sesionesHistoricas = sesiones;
        this.cargandoHistorial = false;
      },
      error: () => {
        if (revision !== this.revisionCarga) return;
        this.cargandoHistorial = false;
        this.sweetAlert.error('Error', 'No se pudo cargar el historial de pases de lista');
      },
    });
  }

  cerrarHistorial(): void {
    this.cargaHistorial?.unsubscribe();
    this.cargandoHistorial = false;
    this.mostrarHistorial = false;
  }

  abrirSesionHistorica(sesion: SesionAsistencia): void {
    if (this.guardandoSesion || !this.materiaSeleccionada ||
        sesion.grupo_materia_id !== this.materiaSeleccionada.id) return;
    this.limpiarPase();
    this.fechaPaseSeleccionada = sesion.fecha.slice(0, 10);
    const solicitud = this.attendanceService.obtenerListaSesion(sesion.id).pipe(map(respuesta => {
      if (respuesta.sesion.id !== sesion.id) throw new Error('La sesión recibida no corresponde al historial seleccionado');
      return respuesta;
    }));
    this.cargarListaSesion(solicitud, this.materiaSeleccionada.id, this.fechaPaseSeleccionada);
  }

  private obtenerFechaLocalActual(): string {
    const fecha = new Date();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
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

  /** Los administradores pueden corregir una sesión incluso después del cierre. */
  get puedeEditarSesion(): boolean {
    return !!this.sesion && !this.isLoadingLista && this.fechaPaseValida &&
      this.sesion.fecha.slice(0, 10) === this.fechaPaseSeleccionada &&
      this.sesion.grupo_materia_id === this.materiaSeleccionada?.id &&
      (!this.sesionCerrada || this.esAdmin);
  }

  cambiarMetodo(metodo: MetodoAsistencia): void {
    if (this.guardandoSesion) return;
    this.metodoActivo = metodo;
  }

  marcarEstado(alumno: AlumnoListaAsistencia, estado: EstadoAsistencia): void {
    if (!this.sesion || !this.puedeEditarSesion || this.guardandoSesion) return;

    const estadoAnterior = alumno.estado;
    alumno.estado = estado;
    this.guardandoAlumnoId = alumno.alumno_id;

    this.guardado = this.attendanceService.registrarManual({
      sesion_id: this.sesion.id,
      alumno_id: alumno.alumno_id,
      estado,
    }).pipe(finalize(() => this.guardandoAlumnoId = null)).subscribe({
      next: resultado => {
        alumno.registro_id = resultado.registro_id;
        alumno.metodo = 'manual';
      },
      error: () => {
        alumno.estado = estadoAnterior;
        this.sweetAlert.error('Error', `No se pudo registrar la asistencia de ${alumno.alumno_nombre}`);
      }
    });
  }

  marcarTodosPresentes(): void {
    if (!this.sesion || !this.puedeEditarSesion || this.guardandoSesion) return;
    const pendientes = this.alumnos.filter(a => a.estado === null);
    if (!pendientes.length) return;
    const sesionId = this.sesion.id;
    let guardados = 0;
    let fallidos = 0;
    this.guardandoPendientes = true;
    this.guardado = from(pendientes).pipe(
      concatMap(alumno => {
        this.guardandoAlumnoId = alumno.alumno_id;
        return this.attendanceService.registrarManual({
          sesion_id: sesionId, alumno_id: alumno.alumno_id, estado: 'presente'
        }).pipe(
          tap(resultado => {
            alumno.estado = 'presente';
            alumno.metodo = 'manual';
            alumno.registro_id = resultado.registro_id;
            guardados++;
          }),
          catchError(() => { fallidos++; return of(null); })
        );
      }),
      finalize(() => { this.guardandoPendientes = false; this.guardandoAlumnoId = null; })
    ).subscribe({
      complete: () => {
        if (fallidos) {
          this.sweetAlert.warning('Registro incompleto', `${guardados} asistencia${guardados === 1 ? '' : 's'} guardada${guardados === 1 ? '' : 's'} y ${fallidos} pendiente${fallidos === 1 ? '' : 's'}. Reintenta antes de cerrar el pase.`);
        } else {
          this.sweetAlert.toast(guardados === 1 ? '1 alumno registrado como presente' : `${guardados} alumnos registrados como presentes`, 'success');
        }
      },
      error: () => this.sweetAlert.error('Error', 'No se pudieron guardar todos los pendientes. Revisa la lista antes de cerrar el pase.')
    });
  }

  // Modo QR (escanear)
  abrirModalQr(): void {
    if (!this.puedeEditarSesion || this.guardandoSesion) return;
    this.tokenManualQr = '';
    this.scannerError = null;
    this.ultimoTokenEscaneado = null;
    this.mostrarModalQr = true;
    this.solicitarPermisoCamara();
  }

  cerrarModalQr(): void {
    this.mostrarModalQr = false;
    this.escaneoActivo = false;
    this.solicitandoPermisoCamara = false;
  }

  /**
   * Pide el permiso desde la acción explícita del usuario. Así el navegador
   * muestra su diálogo antes de que ZXing inicialice el escáner.
   */
  async solicitarPermisoCamara(): Promise<void> {
    if (this.solicitandoPermisoCamara) return;

    this.scannerError = null;
    this.escaneoActivo = false;
    this.solicitandoPermisoCamara = true;

    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        this.scannerError =
          'La cámara requiere una conexión segura. En la laptop abre la plataforma mediante HTTPS o usa exactamente localhost (no una dirección IP).';
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      const dispositivos = await navigator.mediaDevices.enumerateDevices();
      const camaras = dispositivos.filter((dispositivo) => dispositivo.kind === 'videoinput');
      this.camaraSeleccionada =
        camaras.find((camara) => /back|rear|environment/i.test(camara.label)) ?? camaras[0];
      stream.getTracks().forEach((track) => track.stop());
      this.escaneoActivo = true;
    } catch (error: unknown) {
      this.scannerError = this.obtenerMensajeErrorCamara(error);
    } finally {
      this.solicitandoPermisoCamara = false;
    }
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

  onCamerasFound(camaras: MediaDeviceInfo[]): void {
    this.camaraSeleccionada ??=
      camaras.find((camara) => /back|rear|environment/i.test(camara.label)) ?? camaras[0];
  }

  onScanError(error: Error): void {
    this.scannerError = this.obtenerMensajeErrorCamara(error);
  }

  onPermissionResponse(permitido: boolean): void {
    this.scannerError = permitido
      ? null
      : 'El permiso de cámara está bloqueado. Actívalo en el icono de controles del sitio, junto a la dirección, y vuelve a intentar.';
  }

  private obtenerMensajeErrorCamara(error: unknown): string {
    const nombre = error instanceof DOMException || error instanceof Error ? error.name : '';
    if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
      return 'El navegador o Windows bloqueó la cámara. Confirma que la cámara esté permitida tanto en los controles del sitio como en Configuración de Windows > Privacidad y seguridad > Cámara.';
    }
    if (nombre === 'NotReadableError' || nombre === 'TrackStartError') {
      return 'La cámara está siendo utilizada por otra aplicación. Cierra Zoom, Teams, la app Cámara u otra pestaña que la esté usando y reintenta.';
    }
    if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
      return 'No se encontró una cámara compatible. Verifica que esté conectada y habilitada en Windows.';
    }
    return 'No se pudo acceder a la cámara. Verifica que haya una cámara disponible y que ninguna otra aplicación la esté usando.';
  }

  procesarTokenEscaneado(token: string): void {
    if (!this.sesion || !this.puedeEditarSesion || !token.trim() || this.guardandoSesion) return;

    this.isGuardandoQr = true;
    this.guardado = this.attendanceService.registrarQr({ sesion_id: this.sesion.id, token: token.trim() })
      .pipe(finalize(() => this.isGuardandoQr = false)).subscribe({
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
    if (!this.sesion || !this.puedeEditarSesion || this.sesionCerrada || this.guardandoSesion) return;
    const sesionId = this.sesion.id;
    const fecha = this.fechaPaseTexto;
    const materia = this.materiaSeleccionada?.materia_nombre || 'esta materia';
    const grupo = this.grupoActivo ? obtenerNombreGrupo(this.grupoActivo) : '';
    const sinMarcar = this.resumen.sinMarcar;
    const avisoPendientes = sinMarcar === 0 ? '' : sinMarcar === 1
      ? 'Queda 1 alumno sin marcar; se contabilizará como ausente. '
      : `Quedan ${sinMarcar} alumnos sin marcar; se contabilizarán como ausentes. `;
    this.cerrandoSesion = true;
    try {
      const result = await this.sweetAlert.confirm(
        `¿Cerrar el pase del ${fecha}?`,
        `${materia}${grupo ? ` · ${grupo}` : ''}. ${avisoPendientes}Después del cierre, las correcciones requieren un administrador.`,
        'Sí, cerrar este pase', 'Seguir registrando'
      );
      if (!result.isConfirmed || this.destruido) return;
      const sesion = await firstValueFrom(this.attendanceService.cerrarSesion(sesionId));
      if (this.destruido) return;
      if (sesion.id === sesionId && sesion.grupo_materia_id === this.materiaSeleccionada?.id &&
          sesion.fecha.slice(0, 10) === this.fechaPaseSeleccionada) {
        this.sesion = sesion;
        this.sweetAlert.toast('Pase de lista cerrado', 'success');
      } else {
        this.sweetAlert.error('Pase incorrecto', 'La respuesta no corresponde al pase que estabas cerrando. Vuelve a abrirlo para comprobar su estado.');
      }
    } catch {
      if (!this.destruido) this.sweetAlert.error('Error', 'No se pudo cerrar la sesión');
    } finally {
      this.cerrandoSesion = false;
    }
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
