import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import { Calificacion } from '../models/rating.model';
import { buildRatingConcentrado } from './rating-concentrado.utils';

const tareas: Calificacion[] = [
  {
    alumno_id: 1,
    tarea_id: 1,
    tarea_nombre: 'Lectura y comprensión de un texto',
    periodo: 1,
    etiqueta_id: 1,
    etiqueta_nombre: 'Tareas',
    calificacion: 90,
    puntos_obtenidos: null,
  },
  {
    alumno_id: 1,
    tarea_id: 2,
    tarea_nombre: 'Examen',
    periodo: 1,
    etiqueta_id: 2,
    etiqueta_nombre: 'Evaluación',
    calificacion: null,
    puntos_obtenidos: null,
  },
  {
    alumno_id: 1,
    tarea_id: 3,
    tarea_nombre: 'Proyecto',
    periodo: 2,
    etiqueta_id: 1,
    etiqueta_nombre: 'Tareas',
    calificacion: 9,
    puntos_obtenidos: null,
  },
];
const context = {
  materia: 'Español',
  grupo: '3° Grupo B',
  nombrePeriodo: 'Trimestre',
  escalaCaptura: 100,
};

describe('Diseño del concentrado', () => {
  it('separa periodo, etiqueta y tarea sin alterar notas, vacíos o matrículas', () => {
    const wb = buildRatingConcentrado(
      [
        ['Ana Pérez', '00123', 90, '', 9, 9, 1, 5],
        ['Be Melina', '00456', 0, 80, '', 4, '', 4],
      ],
      tareas,
      [1, 2],
      context,
    );
    const ws = wb.Sheets[wb.SheetNames[0]];
    expect(ws['C6'].v).toBe('Trimestre 1');
    expect(ws['E6'].v).toBe('Trimestre 2');
    expect(ws['D7'].v).toBe('Evaluación');
    expect(ws['C8'].v).toBe(tareas[0].tarea_nombre);
    expect(ws['B9'].v).toBe('00123');
    expect(ws['C9'].v).toBe(90);
    expect(ws['E9'].v).toBe(9);
    expect(ws['C10'].v).toBe(0);
    expect(ws['D9'].v).toBe('');
    expect(ws['!autofilter']?.ref).toBe('A8:H10');
    expect(ws['C8'].s.font.bold).toBe(false);
    expect(ws['A6'].s.fill.fgColor.rgb).toBe('212529');
  });

  it('conserva valores y formato al serializar el archivo Excel', () => {
    const wb = buildRatingConcentrado(
      [['Ana Pérez', '00123', 90, '', 9, 9, 1, 5]],
      tareas,
      [1, 2],
      context,
    );
    const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const read = XLSX.read(data, { type: 'array', cellStyles: true });
    const ws = read.Sheets[read.SheetNames[0]];
    expect(ws['B9'].v).toBe('00123');
    expect(ws['C9'].v).toBe(90);
    expect(ws['H9'].v).toBe(5);
    expect(ws['!merges']).toEqual(wb.Sheets['Español']['!merges']);
    expect(ws['A6'].s.fgColor.rgb).toBe('212529');
  });

  it('genera un encabezado válido aun sin tareas o calificaciones', () => {
    const wb = buildRatingConcentrado([], [], [1, 2, 3], context);
    const ws = wb.Sheets[wb.SheetNames[0]];
    expect(ws['!ref']).toBe('A1:F8');
    expect(ws['!autofilter']).toBeUndefined();
    expect(ws['F8'].v).toBe('Promedio final');
  });
});
