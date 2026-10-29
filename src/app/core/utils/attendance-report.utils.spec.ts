import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import * as XLSX from 'xlsx-js-style';
import { AlumnoListaAsistencia, ReporteAsistenciaAlumno, SesionAsistencia } from '../models/attendance.model';
import { Grupo } from '../models/group.model';
import { GrupoMateria } from '../models/groupSubject.model';
import { AttendanceService } from '../services/attendance.service';
import { AuthService } from '../services/auth.service';
import { GroupsService } from '../services/groups.service';
import { GrupoMateriasService } from '../services/grupo-materias.service';
import { SweetAlertService } from '../services/sweet-alert.service';
import { ENV_ASIS } from '../../config/environment';
import { RollCallComponent } from '../../views/home/roll-call/roll-call.component';
import { AttendanceReportContext, buildAttendanceReport } from './attendance-report.utils';

const reporte: ReporteAsistenciaAlumno[] = [
  {
    alumno_id: 1,
    alumno_nombre: 'Ana Pérez García',
    matricula: '00123456',
    total_sesiones: 13,
    presentes: 12,
    retardos: 1,
    justificados: 0,
    ausentes: 0,
    porcentaje_asistencia: 100,
  },
  {
    alumno_id: 2,
    alumno_nombre: 'Be Melina Hernández López',
    matricula: '00123457',
    total_sesiones: 13,
    presentes: 8,
    retardos: 1,
    justificados: 0,
    ausentes: 4,
    porcentaje_asistencia: 69.2,
  },
  {
    alumno_id: 3,
    alumno_nombre: 'María del Carmen González Hernández con apellidos adicionales',
    matricula: '00123458',
    total_sesiones: 13,
    presentes: 0,
    retardos: 0,
    justificados: 0,
    ausentes: 13,
    porcentaje_asistencia: 0,
  },
];
const context: AttendanceReportContext = {
  grupo: '3° Grupo B',
  materia: 'Cultura digital I',
  fechaInicio: '2026-09-01',
  fechaFin: '2026-10-07',
  resumen: {
    promedioAsistencia: 56.4,
    alumnosEnRiesgo: 2,
    totalSesiones: 13,
    totalAsistencias: 20,
    totalFaltas: 17,
  },
};

describe('Excel del reporte de asistencia', () => {
  it('incluye contexto y el mismo resumen mostrado, sin sumar las sesiones por alumno', () => {
    const wb = buildAttendanceReport(reporte, context);
    const ws = wb.Sheets[wb.SheetNames[0]];
    expect(wb.SheetNames).toEqual(['Cultura digital I']);
    expect(ws['A3'].v).toBe('3° Grupo B · Cultura digital I');
    expect(ws['A8'].v).toBeCloseTo(0.564);
    expect(ws['C8'].v).toBe(2);
    expect(ws['E8'].v).toBe(13);
    expect(ws['F8'].v).toBe(20);
    expect(ws['G8'].v).toBe(17);
    expect(ws['A11'].s.fill.fgColor.rgb).toBe('212529');
    expect(ws['!autofilter']?.ref).toBe('A11:H14');
    expect(ws['D11'].v).toBe('Total asistencias');
    expect(ws['G11'].v).toBe('Total faltas');
  });

  it('conserva nombres, matrículas, conteos y porcentajes como datos tipados', () => {
    const original = JSON.stringify(reporte);
    const wb = buildAttendanceReport(reporte, context);
    const ws = wb.Sheets[wb.SheetNames[0]];
    expect(ws['B12'].v).toBe('00123456');
    expect(ws['B12'].t).toBe('s');
    expect(ws['G12'].v).toBe(0);
    expect(ws['D14'].v).toBe(0);
    expect(ws['H13'].v).toBeCloseTo(0.692);
    expect(ws['H14'].v).toBe(0);
    expect(ws['H13'].t).toBe('n');
    expect(ws['H13'].s.numFmt).toBe('0.0%');
    expect(ws['!rows']?.[13].hpt).toBeGreaterThan(28);
    expect(JSON.stringify(reporte)).toBe(original);
  });

  it('mantiene formato y fechas reales al guardar y volver a leer el Excel', () => {
    const wb = buildAttendanceReport(reporte, context);
    const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const read = XLSX.read(data, { type: 'array', cellStyles: true, cellNF: true });
    const ws = read.Sheets[read.SheetNames[0]];
    const inicio = XLSX.SSF.parse_date_code(ws['B4'].v);
    const fin = XLSX.SSF.parse_date_code(ws['D4'].v);
    expect([inicio.y, inicio.m, inicio.d]).toEqual([2026, 9, 1]);
    expect([fin.y, fin.m, fin.d]).toEqual([2026, 10, 7]);
    expect(ws['B12'].v).toBe('00123456');
    expect(ws['H13'].v).toBeCloseTo(0.692);
    expect(ws['H13'].z).toBe('0.0%');
    expect(ws['A11'].s.fgColor.rgb).toBe('212529');
    expect(ws['!autofilter']?.ref).toBe('A11:H14');
  });

  it('no convierte un nombre que empieza con = en una fórmula', () => {
    const wb = buildAttendanceReport([{ ...reporte[0], alumno_nombre: '=SUM(1,2)' }], context);
    const ws = wb.Sheets[wb.SheetNames[0]];
    expect(ws['A12'].t).toBe('s');
    expect(ws['A12'].v).toBe('=SUM(1,2)');
    expect(ws['A12'].f).toBeUndefined();
  });

  it('genera un encabezado válido sin registros y conserva el límite de 75%', () => {
    const empty = buildAttendanceReport([], context);
    expect(empty.Sheets[empty.SheetNames[0]]['!ref']).toBe('A1:H11');
    expect(empty.Sheets[empty.SheetNames[0]]['!autofilter']).toBeUndefined();
    const wb = buildAttendanceReport([{ ...reporte[0], porcentaje_asistencia: 75 }], context);
    expect(wb.Sheets[wb.SheetNames[0]]['H12'].v).toBe(0.75);
  });
});

describe('Registro de asistencia por fecha', () => {
  let component: RollCallComponent;
  let http: HttpTestingController;
  let alerts: { error: ReturnType<typeof vi.fn>; toast: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn>; confirm: ReturnType<typeof vi.fn> };
  const url = `${ENV_ASIS.apiUrl}/attendance`;
  const grupo: Grupo = { id: 1, nombre: 'B', maestro_id: 5, nivel_academico_id: 1, ciclo_escolar_id: 1 };
  const materia: GrupoMateria = { id: 10, grupo_id: 1, maestro_id: 5, materia_id: 2, materia_nombre: 'Biología' };
  const sesion = (overrides: Partial<SesionAsistencia> = {}): SesionAsistencia => ({
    id: 99, grupo_materia_id: 10, maestro_id: 5, fecha: '2026-10-09', metodo_default: 'manual', cerrada: false, ...overrides
  });
  const alumno = (id: number, estado: AlumnoListaAsistencia['estado'] = null): AlumnoListaAsistencia => ({
    alumno_id: id, alumno_nombre: `Alumno ${id}`, matricula: String(id), registro_id: null,
    estado, metodo: null, hora_registro: null
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T18:00:00Z'));
    alerts = { error: vi.fn(), toast: vi.fn(), warning: vi.fn(), confirm: vi.fn().mockResolvedValue({ isConfirmed: true }) };
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: AuthService, useValue: { getUsuario: () => ({ id: 5, rol: 'maestro' }) } },
      { provide: GroupsService, useValue: { obtenerGrupos: () => of([grupo]) } },
      { provide: GrupoMateriasService, useValue: { obtenerGrupoMaterias: () => of([materia]) } },
      { provide: SweetAlertService, useValue: alerts }
    ] });
    http = TestBed.inject(HttpTestingController);
    component = new RollCallComponent(
      { snapshot: { paramMap: convertToParamMap({}) } } as ActivatedRoute,
      { navigate: vi.fn() } as unknown as Router,
      TestBed.inject(AttendanceService),
      {} as GroupsService,
      {} as GrupoMateriasService,
      { getUsuario: () => ({ id: 5, rol: 'maestro' }) } as unknown as AuthService,
      alerts as unknown as SweetAlertService
    );
    component.grupos = [grupo];
    component.grupoMaterias = [materia];
    component.seleccionarGrupo(grupo);
    component.fechaPaseSeleccionada = '2026-10-09';
    component.seleccionarMateria(materia);
  });

  afterEach(() => {
    component.ngOnDestroy();
    http.verify();
    vi.useRealTimers();
  });

  function abrir(alumnos = [alumno(1)], overrides: Partial<SesionAsistencia> = {}): void {
    component.abrirSesionParaFecha();
    http.expectOne(`${url}/session`).flush({ sesion_id: 99 });
    http.expectOne(`${url}/session/99/list`).flush({ sesion: sesion(overrides), alumnos });
  }

  it('seleccionar materia o cambiar de fecha no crea pases de hoy ni del pasado automáticamente', () => {
    component.fechaPaseSeleccionada = '2026-10-29';
    component.cambiarFechaPase();
    component.seleccionarMateria({ ...materia, id: 20 });
    http.expectNone(`${url}/session`);
    expect(component.sesion).toBeNull();
  });

  it('abre explícitamente la fecha seleccionada y evita una segunda solicitud por doble clic', () => {
    component.abrirSesionParaFecha();
    component.abrirSesionParaFecha();
    const request = http.expectOne(`${url}/session`);
    expect(request.request.body).toEqual({ grupo_materia_id: 10, fecha: '2026-10-09' });
    request.flush({ sesion_id: 99 });
    http.expectOne(`${url}/session/99/list`).flush({ sesion: sesion(), alumnos: [alumno(1)] });
    expect(component.fechaPaseTexto).toBe('09/10/2026');
    expect(component.puedeEditarSesion).toBe(true);
  });

  it('cancelar la carga al cambiar de fecha evita que una respuesta vieja aparezca en otro día', () => {
    component.abrirSesionParaFecha();
    http.expectOne(`${url}/session`).flush({ sesion_id: 99 });
    const anterior = http.expectOne(`${url}/session/99/list`);
    component.fechaPaseSeleccionada = '2026-10-29';
    component.cambiarFechaPase();
    expect(anterior.cancelled).toBe(true);
    expect(component.sesion).toBeNull();
    expect(component.alumnos).toEqual([]);
    expect(component.isLoadingLista).toBe(false);
    abrir([alumno(2)], { fecha: '2026-10-29' });
    expect(component.sesion?.fecha).toBe('2026-10-29');
  });

  it('cancela también la apertura anterior antes de recibir el ID de sesión', () => {
    component.abrirSesionParaFecha();
    const anterior = http.expectOne(`${url}/session`);
    component.seleccionarMateria({ ...materia, id: 20 });
    expect(anterior.cancelled).toBe(true);
    expect(component.sesion).toBeNull();
    http.expectNone(`${url}/session/99/list`);
  });

  for (const fecha of ['', '2026-02-31', '2026-10-30']) {
    it(`no cambia una fecha inválida (${fecha || 'vacía'}) por hoy ni crea una sesión`, () => {
      component.fechaPaseSeleccionada = fecha;
      component.cambiarFechaPase();
      component.abrirSesionParaFecha();
      expect(component.fechaPaseSeleccionada).toBe(fecha);
      expect(component.fechaPaseValida).toBe(false);
      expect(alerts.error).toHaveBeenCalledWith('Fecha inválida', expect.any(String));
      http.expectNone(`${url}/session`);
    });
  }

  for (const incorrecta of [{ fecha: '2026-10-29' }, { grupo_materia_id: 20 }, { id: 100 }]) {
    it(`rechaza una respuesta que corresponde a otra sesión: ${JSON.stringify(incorrecta)}`, () => {
      abrir([alumno(1)], incorrecta);
      expect(component.sesion).toBeNull();
      expect(component.puedeEditarSesion).toBe(false);
      expect(alerts.error).toHaveBeenCalled();
    });
  }

  it('abre el historial por ID sin crear otra sesión y conserva su estado cerrado', () => {
    component.abrirSesionHistorica(sesion({ cerrada: true }));
    http.expectNone(`${url}/session`);
    http.expectOne(`${url}/session/99/list`).flush({ sesion: sesion({ cerrada: true }), alumnos: [alumno(1)] });
    expect(component.fechaPaseSeleccionada).toBe('2026-10-09');
    expect(component.sesionCerrada).toBe(true);
    expect(component.puedeEditarSesion).toBe(false);
    component.marcarTodosPresentes();
    http.expectNone(`${url}/register`);
  });

  it('conserva la corrección de pases cerrados para administradores', () => {
    component.usuario = { id: 1, nombre: 'Admin', email: 'admin@example.com', rol: 'admin' };
    abrir([alumno(1)], { cerrada: true });
    expect(component.puedeEditarSesion).toBe(true);
    component.marcarEstado(component.alumnos[0], 'presente');
    http.expectOne(`${url}/register`).flush({ registro_id: 1, estado: 'presente' });
    expect(component.sesionCerrada).toBe(true);
  });

  it('guarda todos los pendientes en secuencia y respeta estados ya registrados, aunque haya una búsqueda', () => {
    abrir([alumno(1), alumno(2), alumno(3), alumno(4, 'ausente')]);
    component.textoBusquedaAlumno = 'Alumno 1';
    component.marcarTodosPresentes();
    component.marcarTodosPresentes();
    for (const id of [1, 2, 3]) {
      const request = http.expectOne(`${url}/register`);
      expect(request.request.body).toEqual({ sesion_id: 99, alumno_id: id, estado: 'presente' });
      expect(component.guardandoSesion).toBe(true);
      request.flush({ registro_id: id, estado: 'presente' });
    }
    expect(component.alumnos.map(a => a.estado)).toEqual(['presente', 'presente', 'presente', 'ausente']);
    expect(component.guardandoSesion).toBe(false);
    expect(alerts.toast).toHaveBeenCalledWith('3 alumnos registrados como presentes', 'success');
  });

  it('informa fallos parciales y reintenta únicamente los alumnos que siguen pendientes', () => {
    abrir([alumno(1), alumno(2), alumno(3)]);
    component.marcarTodosPresentes();
    http.expectOne(`${url}/register`).flush({ registro_id: 1 });
    http.expectOne(`${url}/register`).flush({}, { status: 500, statusText: 'Error' });
    http.expectOne(`${url}/register`).flush({ registro_id: 3 });
    expect(component.alumnos.map(a => a.estado)).toEqual(['presente', null, 'presente']);
    expect(alerts.warning).toHaveBeenCalledWith('Registro incompleto', expect.stringContaining('1 pendiente'));
    component.marcarTodosPresentes();
    const retry = http.expectOne(`${url}/register`);
    expect(retry.request.body.alumno_id).toBe(2);
    retry.flush({ registro_id: 2 });
    expect(component.resumen.sinMarcar).toBe(0);
  });

  it('impide cerrar el pase o cambiar de materia y grupo mientras se guardan pendientes', async () => {
    abrir([alumno(1), alumno(2)]);
    component.marcarTodosPresentes();
    component.seleccionarMateria({ ...materia, id: 20 });
    component.seleccionarGrupo({ ...grupo, id: 2 });
    component.cerrarModal();
    await component.cerrarSesion();
    expect(component.materiaSeleccionada?.id).toBe(10);
    expect(component.grupoSeleccionado).toBe(1);
    expect(component.modalAbierto).toBe(true);
    expect(alerts.confirm).not.toHaveBeenCalled();
    http.expectOne(`${url}/register`).flush({ registro_id: 1 });
    http.expectOne(`${url}/register`).flush({ registro_id: 2 });
  });

  it('al cerrar confirma la materia, fecha y pendientes y conserva el ID durante la confirmación', async () => {
    abrir([alumno(1)]);
    const cierre = component.cerrarSesion();
    expect(alerts.confirm).toHaveBeenCalledWith('¿Cerrar el pase del 09/10/2026?',
      expect.stringContaining('Queda 1 alumno sin marcar'), 'Sí, cerrar este pase', 'Seguir registrando');
    expect(alerts.confirm.mock.calls[0][1]).toContain('Biología');
    component.abrirSesionHistorica(sesion({ id: 123, fecha: '2026-10-29' }));
    expect(component.sesion?.id).toBe(99);
    await Promise.resolve();
    const request = http.expectOne(`${url}/session/99/close`);
    expect(request.request.method).toBe('PATCH');
    request.flush(sesion({ cerrada: true }));
    await cierre;
    expect(component.sesionCerrada).toBe(true);
    expect(component.guardandoSesion).toBe(false);
  });

  it('seguir registrando cancela el cierre sin enviar ninguna actualización', async () => {
    abrir();
    alerts.confirm.mockResolvedValue({ isConfirmed: false });
    await component.cerrarSesion();
    http.expectNone(`${url}/session/99/close`);
    expect(component.sesionCerrada).toBe(false);
    expect(component.guardandoSesion).toBe(false);
  });

  it('no aplica el historial de otra materia y cancela el historial al cambiar de contexto', () => {
    component.abrirSesionHistorica(sesion({ grupo_materia_id: 20 }));
    http.expectNone(`${url}/session/99/list`);
    component.abrirHistorial();
    const anterior = http.expectOne(request => request.url === `${url}/sessions`);
    component.seleccionarMateria({ ...materia, id: 20 });
    expect(anterior.cancelled).toBe(true);
    expect(component.mostrarHistorial).toBe(false);
  });

  it('cerrar el modal cancela la lista para que no se restaure una sesión fuera de contexto', () => {
    component.abrirSesionParaFecha();
    http.expectOne(`${url}/session`).flush({ sesion_id: 99 });
    const request = http.expectOne(`${url}/session/99/list`);
    component.cerrarModal();
    expect(request.cancelled).toBe(true);
    expect(component.sesion).toBeNull();
    expect(component.puedeEditarSesion).toBe(false);
  });

  it('la pantalla exige abrir el día elegido y bloquea el selector de fecha mientras guarda', async () => {
    component.ngOnDestroy();
    const fixture = TestBed.createComponent(RollCallComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.seleccionarGrupo(grupo);
    component.fechaPaseSeleccionada = '2026-10-09';
    component.seleccionarMateria(materia);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const button = [...root.querySelectorAll('button')].find(b => b.textContent?.includes('Abrir pase del'))!;
    expect(button.textContent).toContain('09/10/2026');
    expect(root.textContent).toContain('3. Revisa la fecha y abre el pase');
    http.expectNone(`${url}/session`);
    button.click();
    http.expectOne(`${url}/session`).flush({ sesion_id: 99 });
    http.expectOne(`${url}/session/99/list`).flush({ sesion: sesion(), alumnos: [alumno(1)] });
    fixture.detectChanges();
    expect(root.textContent).toContain('Pase del 09/10/2026');
    component.marcarTodosPresentes();
    fixture.detectChanges();
    await fixture.whenStable();
    const date = root.querySelector<HTMLInputElement>('#attendance-date')!;
    expect(date.disabled).toBe(true);
    expect(root.textContent).toContain('Guardando asistencias');
    http.expectOne(`${url}/register`).flush({ registro_id: 1, estado: 'presente' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(date.disabled).toBe(false);
    expect(component.resumen.sinMarcar).toBe(0);
    fixture.destroy();
  });
});
