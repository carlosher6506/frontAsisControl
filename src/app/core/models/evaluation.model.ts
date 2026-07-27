export interface ConfiguracionEvaluacion {
  id: number;
  grupo_id: number;
  tipo_evaluacion: 'puntos' | 'promedio';
  num_periodos: number;
  tipo_periodo: 'parcial' | 'trimestre';
  tipo_calculo: 'neto' | 'dividido';
  grupo_nombre?: string;
  nivel_academico?: string;
  nivel_educativo?: string;
}

export interface CrearEvaluacion {
  grupo_id: number;
  tipo_evaluacion: 'puntos' | 'promedio';
  num_periodos: number;
  tipo_periodo: 'parcial' | 'trimestre';
  tipo_calculo: 'neto' | 'dividido';
}

export type TipoEvaluacion = ConfiguracionEvaluacion['tipo_evaluacion'];
export type TipoPeriodo = ConfiguracionEvaluacion['tipo_periodo'];
export type TipoCalculo = ConfiguracionEvaluacion['tipo_calculo'];

export interface GrupoDeNivel {
  nivel: string;
  evaluaciones: ConfiguracionEvaluacion[];
}

export interface OpcionSelect<T extends string> {
  value: T;
  label: string;
}
