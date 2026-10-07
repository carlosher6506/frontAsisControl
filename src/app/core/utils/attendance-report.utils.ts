import * as XLSX from 'xlsx-js-style';
import { ReporteAsistenciaAlumno } from '../models/attendance.model';
import { sanitizeSheetName } from './ratings.utils';

export interface AttendanceReportContext {
  grupo: string;
  materia: string;
  fechaInicio: string;
  fechaFin: string;
  resumen: {
    promedioAsistencia: number;
    alumnosEnRiesgo: number;
    totalSesiones: number;
    totalAsistencias: number;
    totalFaltas: number;
  };
}

/** Diseño del reporte guardado: no recalcula porcentajes ni modifica registros. */
export function buildAttendanceReport(
  reporte: readonly ReporteAsistenciaAlumno[],
  context: AttendanceReportContext,
): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet([]);
  const merges: XLSX.Range[] = [];
  const font = { name: 'Arial', sz: 11, bold: false, color: { rgb: '212529' } };
  const fill = (rgb: string) => ({ patternType: 'solid', fgColor: { rgb } });
  const set = (r: number, c: number, v: string | number, style: Record<string, unknown> = {}) => {
    ws[XLSX.utils.encode_cell({ r, c })] = {
      v,
      t: typeof v === 'number' ? 'n' : 's',
      s: {
        font,
        fill: fill('FFFFFF'),
        alignment: {
          vertical: 'center',
          horizontal: typeof v === 'number' ? 'right' : 'left',
          wrapText: true,
        },
        ...style,
      },
    };
  };
  const span = (
    r: number,
    start: number,
    end: number,
    value: string | number,
    style: Record<string, unknown> = {},
  ) => {
    for (let col = start; col <= end; col++) set(r, col, col === start ? value : '', style);
    if (end > start) merges.push({ s: { r, c: start }, e: { r, c: end } });
  };
  // Fechas ISO del filtro como fechas numéricas de Excel, sin desplazamientos de zona horaria.
  const excelDate = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number);
    return (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000;
  };
  for (let r = 0; r <= 9; r++) for (let c = 0; c < 8; c++) set(r, c, '');
  span(1, 0, 7, 'Reporte de asistencia', { font: { ...font, sz: 15 } });
  span(2, 0, 7, context.grupo + ' · ' + context.materia);
  set(3, 0, 'Desde');
  set(3, 1, excelDate(context.fechaInicio), {
    numFmt: 'dd/mm/yyyy',
    alignment: { horizontal: 'left', vertical: 'center' },
  });
  set(3, 2, 'Hasta');
  set(3, 3, excelDate(context.fechaFin), {
    numFmt: 'dd/mm/yyyy',
    alignment: { horizontal: 'left', vertical: 'center' },
  });
  span(3, 5, 7, 'AsisControlGo', {
    font: { ...font, color: { rgb: '6C757D' } },
    alignment: { horizontal: 'right', vertical: 'center' },
  });
  span(5, 0, 7, 'Resumen del grupo', { fill: fill('E9ECEF') });
  const resumen = context.resumen;
  const indicadores = [
    {
      start: 0,
      end: 1,
      label: 'Promedio del grupo',
      value: resumen.promedioAsistencia / 100,
      numFmt: '0.0%',
    },
    {
      start: 2,
      end: 3,
      label: 'Alumnos en riesgo (<75%)',
      value: resumen.alumnosEnRiesgo,
      numFmt: '#,##0',
    },
    { start: 4, end: 4, label: 'Total sesiones', value: resumen.totalSesiones, numFmt: '#,##0' },
    {
      start: 5,
      end: 5,
      label: 'Total asistencias',
      value: resumen.totalAsistencias,
      numFmt: '#,##0',
    },
    { start: 6, end: 7, label: 'Total faltas', value: resumen.totalFaltas, numFmt: '#,##0' },
  ];
  for (const item of indicadores) {
    span(6, item.start, item.end, item.label, {
      fill: fill('F1F3F5'),
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    });
    span(7, item.start, item.end, item.value, {
      numFmt: item.numFmt,
      font: { ...font, sz: 12 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { bottom: { style: 'thin', color: { rgb: 'DEE2E6' } } },
    });
  }
  span(8, 0, 7, 'Asistencias = presentes. Faltas = ausentes. Riesgo: asistencia menor al 75%.', {
    font: { ...font, color: { rgb: '6C757D' } },
  });
  const headers = [
    'Alumno',
    'Matrícula',
    'Total sesiones',
    'Total asistencias',
    'Retardos',
    'Justificados',
    'Total faltas',
    '% Asistencia',
  ];
  headers.forEach((header, col) =>
    set(10, col, header, {
      fill: fill('212529'),
      font: { ...font, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { right: { style: 'thin', color: { rgb: 'FFFFFF' } } },
    }),
  );
  for (const [index, alumno] of reporte.entries()) {
    const values = [
      alumno.alumno_nombre,
      alumno.matricula,
      Number(alumno.total_sesiones),
      Number(alumno.presentes),
      Number(alumno.retardos),
      Number(alumno.justificados),
      Number(alumno.ausentes),
      Number(alumno.porcentaje_asistencia) / 100,
    ];
    values.forEach((value, col) =>
      set(index + 11, col, value, {
        fill: fill(index % 2 ? 'F8F9FA' : 'FFFFFF'),
        numFmt: col === 1 ? '@' : col === 7 ? '0.0%' : col >= 2 ? '#,##0' : '@',
        border: { bottom: { style: 'hair', color: { rgb: 'E9ECEF' } } },
      }),
    );
  }
  ws['!ref'] = `A1:H${Math.max(11, reporte.length + 11)}`;
  ws['!merges'] = merges;
  ws['!cols'] = [38, 18, 16, 14, 14, 16, 14, 18].map((wch) => ({ wch }));
  const lines = (text: string, width: number) =>
    text.split(/\r?\n/).reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / width)), 0);
  ws['!rows'] = [
    { hpt: 10 },
    { hpt: 26 },
    { hpt: Math.max(24, lines(context.grupo + ' · ' + context.materia, 130) * 15 + 8) },
    { hpt: 24 },
    { hpt: 10 },
    { hpt: 24 },
    { hpt: 36 },
    { hpt: 28 },
    { hpt: 28 },
    { hpt: 10 },
    { hpt: 34 },
    ...reporte.map((alumno) => ({ hpt: Math.max(28, lines(alumno.alumno_nombre, 38) * 15 + 8) })),
  ];
  if (reporte.length) ws['!autofilter'] = { ref: `A11:H${reporte.length + 11}` };
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: 'Reporte de asistencia',
    Author: 'AsisControlGo',
    Subject: context.materia,
  };
  XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName(context.materia || 'Reporte'));
  return workbook;
}

export function downloadAttendanceReport(workbook: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(workbook, filename, { compression: true });
}
