export interface Alumno {
  id: number;
  nombre: string;
  matricula: string;
  nivel_educativo: string;
  nivel_academico: string;
  grupo_id: number;
  grupo_nombre: string;
  grupos_nombres: string[];
  ciclo_escolar: string;
}

export interface ActualizarAlumno {
  nombre: string;
  nivel_educativo_id?: number | null;
  grupo_id?: number | null;
  grupo_ids?: number[];
}

export interface CrearAlumno {
  nombre: string;
  nivel_educativo_id?: number;
}
