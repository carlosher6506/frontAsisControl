export interface Alumno {
  id: number;
  grupo_id: number;
  nombre: string;
  matricula: string;
  grupo_nombre?: string;
  nivel_academico?: string;
  nivel_educativo?: string;
  ciclo_escolar?: string;
}

export interface CrearAlumno {
  grupo_id: number;
  nombre: string;
  matricula: string;
}

export interface ActualizarAlumno {
  nombre: string;
}
