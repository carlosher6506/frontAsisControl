import { describe, expect, it } from 'vitest';
import { Calificacion } from '../models/rating.model';
import { Alumno } from '../models/student.model';
import { hasRatingChanged } from './ratings.utils';
import {
  completeRatingGridRow,
  createRatingGridRow,
  groupRatingTasks,
  ratingForRequest,
  ratingFromApi,
} from './ratings-grid.utils';

const alumno = { id: 1, nombre: 'Ana' } as Alumno;
const tarea = (id: number, overrides: Partial<Calificacion> = {}): Calificacion => ({
  alumno_id: 1,
  tarea_id: id,
  calificacion: null,
  puntos_obtenidos: null,
  periodo: 1,
  tarea_nombre: 'Tarea ' + id,
  ...overrides,
});

describe('Matriz de calificaciones', () => {
  it('mantiene 90 en captura después de leer una nota de 9 de la API', () => {
    expect(ratingFromApi(tarea(1, { calificacion: 9 }), true).calificacion).toBe(90);
  });
  it('no interpreta una captura de 9 sobre 100 como 90', () => {
    expect(ratingForRequest(9, true)).toBe(9);
    expect(ratingFromApi(tarea(1, { calificacion: 0.9 }), true).calificacion).toBe(9);
  });
  it('adapta la captura sobre 10 al endpoint que divide entre diez', () => {
    expect(ratingForRequest(8, false)).toBe(80);
    expect(ratingFromApi(tarea(1, { calificacion: 8 }), false).calificacion).toBe(8);
  });
  it('conserva cero y notas vacías sin inventar notas', () => {
    expect(ratingFromApi(tarea(1, { calificacion: 0 }), true).calificacion).toBe(0);
    expect(ratingFromApi(tarea(1), true).calificacion).toBeNull();
    expect(ratingForRequest(null, true)).toBeNull();
  });
  it('agrupa por etiqueta y periodo, sin repetir tareas compartidas por alumnos', () => {
    const tareas = [
      tarea(2, { etiqueta_id: 1, etiqueta_nombre: 'Prácticas' }),
      tarea(1, { etiqueta_id: 2, etiqueta_nombre: 'Exámenes' }),
      tarea(2),
      tarea(3, { periodo: 2, etiqueta_nombre: 'Exámenes' }),
      tarea(4),
    ];
    // La misma tarea siempre tiene la misma metadata, aunque se repita por alumno.
    tareas[2] = { ...tareas[0], alumno_id: 2 };
    const grupos = groupRatingTasks(tareas, 1);
    expect(grupos.map((g) => g.nombre)).toEqual(['Exámenes', 'Prácticas', 'Sin etiqueta']);
    expect(grupos.flatMap((g) => g.tareas).map((t) => t.tarea_id)).toEqual([1, 2, 4]);
  });
  it('mantiene snapshots independientes para alumnos con las mismas tareas', () => {
    const ana = createRatingGridRow(alumno, [tarea(1, { calificacion: 9 })], true);
    const bea = createRatingGridRow({ ...alumno, id: 2 }, [tarea(1, { calificacion: 8 })], true);
    ana.calificaciones[0].calificacion = 70;
    expect(hasRatingChanged(ana.calificaciones[0], ana.estadoInicial)).toBe(true);
    expect(hasRatingChanged(bea.calificaciones[0], bea.estadoInicial)).toBe(false);
    expect(bea.calificaciones[0].alumno_id).toBe(2);
  });
  it('crea celdas vacías sin copiar notas ajenas ni borrar borradores', () => {
    const fila = createRatingGridRow(alumno, [tarea(1, { calificacion: 9 })], true);
    fila.calificaciones[0].calificacion = 80;
    completeRatingGridRow(fila, [tarea(1), tarea(2, { alumno_id: 2, calificacion: 100, id: 99 })]);
    expect(fila.celdas.get(1)?.calificacion).toBe(80);
    expect(fila.celdas.get(2)).toMatchObject({ alumno_id: 1, calificacion: null, id: undefined });
    expect(hasRatingChanged(fila.celdas.get(2)!, fila.estadoInicial)).toBe(false);
  });
  it('no habilita celdas ficticias en un alumno cuya carga falló', () => {
    const fila = createRatingGridRow(alumno, [], true, true);
    completeRatingGridRow(fila, [tarea(1)]);
    expect(fila.celdas.size).toBe(0);
  });
});
