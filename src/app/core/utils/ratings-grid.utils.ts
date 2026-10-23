import { Calificacion } from '../models/rating.model';
import { Alumno } from '../models/student.model';
import {
  createRatingSnapshot,
  normalizeNullableNumber,
  RatingSnapshot,
  roundTo,
} from './ratings.utils';

export interface RatingGridRow {
  alumno: Alumno;
  calificaciones: Calificacion[];
  celdas: Map<number, Calificacion>;
  estadoInicial: Map<number, RatingSnapshot>;
  errorCarga: boolean;
  cargando: boolean;
}

export interface RatingTaskGroup {
  clave: string;
  nombre: string;
  tareas: Calificacion[];
}

// La API devuelve la nota sobre 10. La tabla usa siempre la escala de
// captura, incluso después de guardar (90 sigue siendo 90).
export function ratingFromApi(rating: Calificacion, usesHundredScale: boolean): Calificacion {
  return {
    ...rating,
    calificacion:
      rating.calificacion == null
        ? null
        : roundTo(Number(rating.calificacion) * (usesHundredScale ? 10 : 1)),
    puntos_obtenidos: normalizeNullableNumber(rating.puntos_obtenidos),
  };
}

// El endpoint divide la nota entre 10 al guardar, en todos los niveles.
export function ratingForRequest(value: number | null, usesHundredScale: boolean): number | null {
  return value == null ? null : roundTo(Number(value) * (usesHundredScale ? 1 : 10));
}

export function createRatingGridRow(
  alumno: Alumno,
  ratings: Calificacion[],
  usesHundredScale: boolean,
  errorCarga = false,
): RatingGridRow {
  const calificaciones = ratings.map((rating) => ({
    ...ratingFromApi(rating, usesHundredScale),
    alumno_id: alumno.id,
  }));
  return {
    alumno,
    calificaciones,
    celdas: new Map(calificaciones.map((rating) => [rating.tarea_id, rating])),
    estadoInicial: createRatingSnapshot(calificaciones),
    errorCarga,
    cargando: false,
  };
}

export function sortRatingTasks(ratings: readonly Calificacion[]): Calificacion[] {
  return [...new Map(ratings.map((rating) => [rating.tarea_id, rating])).values()].sort(
    (a, b) =>
      (a.periodo ?? 1) - (b.periodo ?? 1) ||
      (a.etiqueta_nombre || 'Sin etiqueta').localeCompare(
        b.etiqueta_nombre || 'Sin etiqueta',
        'es',
      ) ||
      (a.etiqueta_id ?? 0) - (b.etiqueta_id ?? 0) ||
      (a.fecha || '').localeCompare(b.fecha || '') ||
      (a.tarea_nombre || '').localeCompare(b.tarea_nombre || '', 'es') ||
      a.tarea_id - b.tarea_id,
  );
}

export function groupRatingTasks(
  ratings: readonly Calificacion[],
  period: number,
): RatingTaskGroup[] {
  const grupos = new Map<string, RatingTaskGroup>();
  for (const tarea of sortRatingTasks(ratings).filter(
    (rating) => (rating.periodo ?? 1) === period,
  )) {
    const nombre = tarea.etiqueta_nombre?.trim() || 'Sin etiqueta';
    const clave = tarea.etiqueta_id == null ? 'nombre:' + nombre : 'id:' + tarea.etiqueta_id;
    const grupo = grupos.get(clave) ?? { clave, nombre, tareas: [] };
    grupo.tareas.push(tarea);
    grupos.set(clave, grupo);
  }
  return [...grupos.values()];
}

export function completeRatingGridRow(row: RatingGridRow, tasks: readonly Calificacion[]): void {
  if (row.errorCarga) return;
  for (const tarea of tasks) {
    if (row.celdas.has(tarea.tarea_id)) continue;
    const calificacion: Calificacion = {
      ...tarea,
      id: undefined,
      alumno_id: row.alumno.id,
      calificacion: null,
      puntos_obtenidos: null,
    };
    row.calificaciones.push(calificacion);
    row.celdas.set(tarea.tarea_id, calificacion);
    row.estadoInicial.set(tarea.tarea_id, { calificacion: null, puntosObtenidos: null });
  }
}
