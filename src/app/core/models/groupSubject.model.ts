export interface GrupoMateria {
  id: number;
  grupo_id: number;
  materia_id: number;
  maestro_id: number;
  materia_nombre?: string;
  grupo_nombre?: string;
  maestro_nombre?: string;
  nivel_academico?: string;
  nivel_educativo?: string;
}

export interface CrearGrupoMateria {
  grupo_id: number;
  materia_id: number;
  maestro_id: number;
}
