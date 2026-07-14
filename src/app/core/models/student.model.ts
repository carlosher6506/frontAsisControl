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

export interface CrearAlumno {
  nombre: string;
  grupo_id: number;
}

export interface ActualizarAlumno {
  nombre: string;
}
