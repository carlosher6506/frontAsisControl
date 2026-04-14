export interface Calificacion {
  id?: number;
  alumno_id: number;
  tarea_id: number;
  calificacion: number | null;
  puntos_obtenidos: number | null;
  alumno_nombre?: string;
  tarea_nombre?: string;
  periodo?: number;
  fecha?: string;
  etiqueta_id?: number | null;
  etiqueta_nombre?: string;
  valor_total?: number;
  valor_tarea?: number;        // ← valor calculado de esta tarea
  tareas_por_etiqueta?: number;
}

export interface CalificarRequest {
  alumno_id: number;
  tarea_id: number;
  calificacion: number | null;
  puntos_obtenidos?: number | null;
}

export interface BoletaMateria {
  materia_nombre: string;
  periodo: number;
  tipo_evaluacion: string;
  tipo_calculo: string;
  num_periodos: number;
  tipo_periodo: string;
  calificacion_minima_aprobatoria: number;
  forzar_minimo: boolean;
  promedio_calificaciones: number | null;
  total_puntos_obtenidos: number | null;
  total_puntos_posibles: number | null;
}

export interface Boleta {
  alumno: {
    id: number;
    nombre: string;
    matricula: string;
    grupo_nombre: string;
    nivel_academico: string;
    nivel_educativo: string;
    ciclo_escolar: string;
  };
  calificaciones: BoletaMateria[];
}
