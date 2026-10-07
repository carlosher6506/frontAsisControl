import * as XLSX from 'xlsx-js-style';
import { Calificacion } from '../models/rating.model';
import { sanitizeSheetName } from './ratings.utils';

export interface RatingConcentradoContext {
  materia: string;
  grupo: string;
  nombrePeriodo: string;
  escalaCaptura: number;
}

/** Presentación del concentrado. Las notas y promedios llegan calculados, sin cambiarlos. */
export function buildRatingConcentrado(
  filas: (string | number)[][],
  tareas: readonly Calificacion[],
  periodos: readonly number[],
  context: RatingConcentradoContext,
): XLSX.WorkBook {
  const totalColumnas = 2 + tareas.length + periodos.length + 1;
  const inicioFinales = 2 + tareas.length;
  const ws = XLSX.utils.aoa_to_sheet([]);
  const merges: XLSX.Range[] = [];
  const fuente = { name: 'Arial', sz: 11, bold: false, color: { rgb: '212529' } };
  const set = (
    row: number,
    col: number,
    value: string | number,
    style: Record<string, unknown> = {},
  ) => {
    ws[XLSX.utils.encode_cell({ r: row, c: col })] = {
      v: value,
      t: typeof value === 'number' ? 'n' : 's',
      s: {
        font: fuente,
        fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
        alignment: {
          vertical: 'center',
          horizontal: typeof value === 'number' ? 'right' : 'left',
          wrapText: true,
        },
        ...style,
      },
    };
  };
  const band = (
    row: number,
    start: number,
    end: number,
    value: string,
    fill: string,
    color = '212529',
  ) => {
    for (let col = start; col <= end; col++)
      set(row, col, col === start ? value : '', {
        font: { ...fuente, color: { rgb: color } },
        fill: { patternType: 'solid', fgColor: { rgb: fill } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      });
    if (end > start) merges.push({ s: { r: row, c: start }, e: { r: row, c: end } });
  };
  const anchoTitulo = Math.min(totalColumnas - 1, 6);
  for (let row = 0; row <= 4; row++) {
    for (let col = 0; col < totalColumnas; col++) {
      set(row, col, '', { fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } } });
    }
  }
  set(1, 0, 'Concentrado de calificaciones', { font: { ...fuente, sz: 15 } });
  set(2, 0, context.grupo + ' · ' + context.materia);
  set(
    3,
    0,
    'Tareas: 0 a ' +
      context.escalaCaptura +
      '. Calificaciones finales: 0 a 10. Celda vacía: sin calificar.',
    { font: { ...fuente, color: { rgb: '5B6570' } } },
  );
  for (const row of [1, 2, 3]) merges.push({ s: { r: row, c: 0 }, e: { r: row, c: anchoTitulo } });
  band(5, 0, 1, 'Alumnos', '212529', 'FFFFFF');
  band(6, 0, 1, 'Identificación', 'E9ECEF');
  for (let start = 0; start < tareas.length;) {
    const periodo = tareas[start].periodo ?? 1;
    let end = start;
    while (end + 1 < tareas.length && (tareas[end + 1].periodo ?? 1) === periodo) end++;
    band(5, start + 2, end + 2, context.nombrePeriodo + ' ' + periodo, '212529', 'FFFFFF');
    start = end + 1;
  }
  for (let start = 0; start < tareas.length;) {
    const tarea = tareas[start];
    const etiqueta = tarea.etiqueta_nombre || 'Sin etiqueta';
    let end = start;
    while (
      end + 1 < tareas.length &&
      (tareas[end + 1].periodo ?? 1) === (tarea.periodo ?? 1) &&
      (tareas[end + 1].etiqueta_id ?? tareas[end + 1].etiqueta_nombre ?? '') ===
        (tarea.etiqueta_id ?? tarea.etiqueta_nombre ?? '')
    )
      end++;
    band(6, start + 2, end + 2, etiqueta, 'E9ECEF');
    start = end + 1;
  }
  band(5, inicioFinales, totalColumnas - 1, 'Calificaciones finales (0 a 10)', '212529', 'FFFFFF');
  band(6, inicioFinales, totalColumnas - 1, 'Promedios', 'E9ECEF');
  const headers = [
    'Alumno',
    'Matrícula',
    ...tareas.map((t) => t.tarea_nombre || 'Tarea'),
    ...periodos.map((p) => context.nombrePeriodo + ' ' + p),
    'Promedio final',
  ];
  headers.forEach((header, col) =>
    set(7, col, header, {
      fill: { patternType: 'solid', fgColor: { rgb: 'F1F3F5' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { bottom: { style: 'thin', color: { rgb: 'ADB5BD' } } },
    }),
  );
  filas.forEach((fila, index) =>
    fila.forEach((value, col) =>
      set(index + 8, col, value, {
        fill: {
          patternType: 'solid',
          fgColor: { rgb: col >= inicioFinales ? 'F4F1E8' : index % 2 ? 'F8F9FA' : 'FFFFFF' },
        },
        numFmt:
          col === 1
            ? '@'
            : col >= inicioFinales
              ? '0'
              : col >= 2
                ? Number.isInteger(value)
                  ? '0'
                  : '0.##'
                : '@',
        border: { bottom: { style: 'hair', color: { rgb: 'E9ECEF' } } },
      }),
    ),
  );
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(7, filas.length + 7), c: totalColumnas - 1 },
  });
  ws['!merges'] = merges;
  ws['!cols'] = headers.map((_, index) => ({
    wch: index === 0 ? 38 : index === 1 ? 18 : index >= inicioFinales ? 19 : 22,
  }));
  const lineas = (value: string, ancho: number) =>
    value
      .split(/\r?\n/)
      .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / ancho)), 0);
  ws['!rows'] = [
    { hpt: 10 },
    { hpt: 26 },
    { hpt: 24 },
    { hpt: 30 },
    { hpt: 10 },
    { hpt: 28 },
    {
      hpt: Math.max(
        26,
        ...tareas.map((t) => lineas(t.etiqueta_nombre || 'Sin etiqueta', 22) * 15 + 8),
      ),
    },
    {
      hpt: Math.max(
        40,
        ...headers.map((h, col) => lineas(h, col === 0 ? 38 : col === 1 ? 18 : 22) * 15 + 10),
      ),
    },
    ...filas.map((fila) => ({ hpt: Math.max(26, lineas(String(fila[0] ?? ''), 38) * 15 + 8) })),
  ];
  if (filas.length)
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 7, c: 0 },
        e: { r: filas.length + 7, c: totalColumnas - 1 },
      }),
    };
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: 'Concentrado de calificaciones',
    Author: 'AsisControlGo',
    Subject: context.materia,
  };
  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(context.materia || 'Concentrado'));
  return wb;
}

export function downloadRatingConcentrado(workbook: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(workbook, filename, { compression: true });
}
