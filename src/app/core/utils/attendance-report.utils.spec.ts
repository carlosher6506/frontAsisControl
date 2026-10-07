import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import { ReporteAsistenciaAlumno } from '../models/attendance.model';
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
