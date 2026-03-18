export interface Grupo {
  id: number;
  nivel_academico_id: number;
  ciclo_escolar_id: number;
  maestro_id: number;
  nombre: string;
}

export interface CrearGrupo {
  nivel_academico_id: number;
  ciclo_escolar_id: number;
  maestro_id: number;
  nombre: string;
}

export interface ActualizarGrupo {
  nombre: string;
  maestro_id: number;
}
