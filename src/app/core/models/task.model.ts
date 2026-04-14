export interface Tarea {
  id: number;
  grupo_materia_id: number;
  nombre: string;
  fecha: string;
  periodo: number;
  etiqueta_id?: number | null;
  etiqueta_nombre?: string;
  valor_total?: number;
  materia_nombre?: string;
  grupo_nombre?: string;
  nivel_academico?: string;
  nivel_educativo?: string;
  valor_propio?: number | null;
}

export interface CrearTarea {
  grupo_materia_id: number;
  nombre: string;
  fecha: string | null;
  periodo: number;
  etiqueta_id?: number | null;
  valor_propio?: number | null;
}
