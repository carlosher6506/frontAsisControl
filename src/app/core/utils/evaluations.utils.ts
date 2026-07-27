import { ConfiguracionEvaluacion, GrupoDeNivel } from '../models/evaluation.model'
import { ORDEN_NIVELES_ACADEMICOS } from '../constants/evaluations.constants'

const SIN_NIVEL = 'Sin nivel';

export function agruparPorNivelAcademico(evaluaciones: readonly ConfiguracionEvaluacion[]):GrupoDeNivel[]{
  const porNivel = new Map<string, ConfiguracionEvaluacion[]>();

  for (const evaluacion of evaluaciones){
    const nivel = evaluacion.nivel_educativo?.trim() || SIN_NIVEL;
    const lista = porNivel.get(nivel) ?? [];
    lista.push(evaluacion);
    porNivel.set(nivel, lista);
  }

  return Array.from(porNivel, ([nivel, items])=> ({nivel, evaluaciones: items}))
    .sort(( a, b ) =>{
      const posicionA = ORDEN_NIVELES_ACADEMICOS.indexOf(a.nivel);
      const posicionB = ORDEN_NIVELES_ACADEMICOS.indexOf(b.nivel);
      if (posicionA === -1 && posicionB === -1) return a.nivel.localeCompare(b.nivel);
      if (posicionA === -1) return -1;
      if (posicionB === -1) return 1;
      return posicionA - posicionB;
    });
}
