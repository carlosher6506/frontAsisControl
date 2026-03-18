export interface NivelAcademico {
  id: number;
  nivel_educativo_id: number;
  nivel_educativo?: string;
  nombre: string;
  orden: number;
}

export interface CrearNivelAcademico {
  nivel_educativo_id: number;
  nombre: string;
  orden: number;
}

export interface ActualizarNivelAcademico {
  nivel_educativo_id: number;
  nombre: string;
  orden: number;
}
