import { OpcionSelect, TipoCalculo, TipoEvaluacion, TipoPeriodo } from '../models/evaluation.model'

export const ORDEN_NIVELES_ACADEMICOS: readonly string[] = ['Preescolar', 'Primaria', 'Secundaria', 'Preparatoria'];

export const TIPOS_EVALUACION: readonly OpcionSelect<TipoEvaluacion>[] = [
  {value: 'puntos', label: 'Por puntos'},
  {value: 'promedio', label: 'Por promedio'}
];

export const TIPOS_PERIODO: readonly OpcionSelect<TipoPeriodo>[] = [
  {value: 'parcial', label: 'Parciales'},
  {value: 'trimestre', label: 'Trimestres'}
];

export const TIPOS_CALCULO: readonly OpcionSelect<TipoCalculo>[] = [
  {value: 'neto', label: 'Netos'},
  {value: 'dividido', label: 'Dividido'}
];
