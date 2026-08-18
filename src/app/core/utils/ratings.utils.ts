import { Calificacion } from '../models/rating.model';

export interface RatingSnapshot {
  calificacion: number | null;
  puntosObtenidos: number | null;
}

export const DECIMAL_PLACES = 2;

export function roundTo(value: number, decimals = DECIMAL_PLACES): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function normalizeNullableNumber(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : roundTo(Number(value));
}

export function createRatingSnapshot(
  ratings: readonly Calificacion[],
): Map<number, RatingSnapshot> {
  return new Map(
    ratings.map((rating) => [
      rating.tarea_id,
      {
        calificacion: normalizeNullableNumber(rating.calificacion),
        puntosObtenidos: normalizeNullableNumber(rating.puntos_obtenidos),
      },
    ]),
  );
}

export function hasRatingChanged(
  rating: Calificacion,
  snapshots: ReadonlyMap<number, RatingSnapshot>,
): boolean {
  const snapshot = snapshots.get(rating.tarea_id);
  if (!snapshot) return true;

  return (
    snapshot.calificacion !== normalizeNullableNumber(rating.calificacion) ||
    snapshot.puntosObtenidos !== normalizeNullableNumber(rating.puntos_obtenidos)
  );
}

/**
 * Calcula la calificación de un periodo, siempre expresada en escala 0-10.
 *
 * IMPORTANTE sobre escalas:
 * - Cuando el grupo/materia captura en escala 0-100 (puntos o primaria), se
 *   asume que `calificacion`/`puntos_obtenidos` fueron guardados en 0-100.
 *   Por eso aquí se divide entre 10 (o se calcula como proporción * 10).
 * - Si los valores capturados NO están realmente en escala 0-100 (p. ej. se
 *   guardó "9" pensando en escala 0-10), el resultado saldrá 10 veces más
 *   pequeño de lo esperado. Ese es un problema de captura, no de esta
 *   fórmula — hay que volver a capturar esos valores multiplicados por 10.
 */
export function calculatePeriodGrade(
  ratings: readonly Calificacion[],
  isPointsBased: boolean,
): number {
  if (isPointsBased) {
    const maximumPoints = ratings.reduce(
      (total, rating) => total + (Number(rating.valor_tarea) || 0),
      0,
    );
    const earnedPoints = ratings.reduce(
      (total, rating) => total + (Number(rating.puntos_obtenidos) || 0),
      0,
    );
    return maximumPoints ? (earnedPoints / maximumPoints) * 10 : 0;
  }

  // Evaluación por promedio (incluye primaria): la calificación ya se
  // captura en escala 0-10, se promedia tal cual, sin dividir entre 10.
  const grades = ratings
    .filter((rating) => rating.calificacion !== null)
    .map((rating) => Number(rating.calificacion));

  if (!grades.length) return 0;

  return grades.reduce((total, grade) => total + grade, 0) / grades.length;
}

export function formatTwoDecimals(value: number): string {
  return roundTo(value).toFixed(DECIMAL_PLACES);
}

export function roundFinalGrade(value: number): number {
  return Math.round(value);
}

/**
 * Equivalente en escala 0-10 de un valor capturado. Cuando el grupo/materia
 * usa escala 0-100 (`usaEscalaCien`), se divide entre 10; si ya está en
 * escala 0-10, se devuelve tal cual. Pensado para mostrarse como texto de
 * apoyo junto al campo de captura, para que quien califica vea de inmediato
 * a qué calificación en base 10 equivale lo que está escribiendo.
 */
export function equivalenteEscalaDiez(
  valor: number | null | undefined,
  usaEscalaCien: boolean,
): string | null {
  if (valor === null || valor === undefined) return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;

  const equivalente = usaEscalaCien ? numero / 10 : numero;
  return equivalente.toFixed(1);
}

export function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

export function sanitizeSheetName(value: string): string {
  return value.replace(/[\\/*?:\[\]]/g, '').slice(0, 31) || 'Concentrado';
}
