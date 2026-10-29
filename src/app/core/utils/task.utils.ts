import { Grupo } from '../models/group.model';
import { GrupoMateria } from '../models/groupSubject.model';
import { FiltrosGrupoTareas, Tarea } from '../models/task.model';

// Unifica identificadores/decimales serializados como texto y el periodo
// predeterminado que también usa el apartado de calificaciones.
export function normalizarTarea(tarea: Tarea): Tarea {
  return {
    ...tarea,
    id: Number(tarea.id),
    grupo_materia_id: Number(tarea.grupo_materia_id),
    periodo: Number(tarea.periodo ?? 1),
    etiqueta_id: tarea.etiqueta_id == null ? null : Number(tarea.etiqueta_id),
    valor_propio: tarea.valor_propio == null ? null : Number(tarea.valor_propio)
  };
}

export function normalizarTexto(valor: string | null | undefined): string {
  return (valor ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Convierte el grado numérico a su forma ordinal en español.
export function gradoAOrdinal(grado: number | string | null | undefined): string {
  const n = Number(grado);
  if (!n || isNaN(n)) return '';
  const sufijos: Record<number, string> = { 1: '1°', 2: '2°', 3: '3°' };
  return sufijos[n] ?? `${n}°`;
}

export function obtenerNombreGrupo(grupo: Grupo): string {
  const gradoRaw = grupo.nivel_academico ?? grupo.nivel_academico_id ?? '';
  const gradoNum = Number(gradoRaw);
  const grado = !isNaN(gradoNum) && gradoNum > 0
    ? `${gradoAOrdinal(gradoNum)} grado`
    : String(gradoRaw);
  const nombre = grupo.nombre ? ` Grupo ${grupo.nombre}` : '';
  return `${grado}${nombre}`.trim();
}

// Determina si un grupo cumple con los filtros activos
export function grupoCoincideConFiltros(
  grupo: Grupo,
  materiasDelGrupo: GrupoMateria[],
  filtros: FiltrosGrupoTareas
): boolean {
  if (filtros.nivelAcademico && String(grupo.nivel_academico ?? grupo.nivel_academico_id) !== filtros.nivelAcademico) {
    return false;
  }
  if (filtros.grupo && grupo.nombre !== filtros.grupo) {
    return false;
  }
  if (filtros.materia) {
    const tieneMateria = materiasDelGrupo.some(gm => gm.materia_nombre === filtros.materia);
    if (!tieneMateria) return false;
  }
  if (filtros.texto) {
    const texto = normalizarTexto(filtros.texto);
    const coincideNombre = normalizarTexto(obtenerNombreGrupo(grupo)).includes(texto);
    const coincideMateria = materiasDelGrupo.some(gm => normalizarTexto(gm.materia_nombre).includes(texto));
    if (!coincideNombre && !coincideMateria) return false;
  }
  return true;
}
