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
