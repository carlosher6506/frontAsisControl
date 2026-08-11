import { FiltrosGrupoTareas } from '../models/task.model';

// Los niveles educativos se derivan dinámicamente del API.
// Este array solo sirve como orden de visualización de los tabs.
export const ORDEN_NIVELES_EDUCATIVOS = [
  'Preescolar',
  'Primaria',
  'Secundaria',
  'Preparatoria',
  'Licenciatura',
] as const;

export const FILTROS_INICIALES: FiltrosGrupoTareas = {
  texto: '',
  nivelAcademico: '',
  grupo: '',
  materia: '',
};

export type NivelEducativo = string;
