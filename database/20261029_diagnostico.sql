-- Solo lectura. Comprueba el estado ACTIVO, que puede diferir del historial.

-- 1. Totales completos (sin depender del máximo de filas de la Data API).
SELECT 'alumnos' AS entidad, count(*) AS total FROM public.alumnos
UNION ALL SELECT 'tareas', count(*) FROM public.tareas
UNION ALL SELECT 'calificaciones', count(*) FROM public.calificaciones
UNION ALL SELECT 'etiquetas', count(*) FROM public.etiquetas
UNION ALL SELECT 'alumno_grupos', count(*) FROM public.alumno_grupos;

-- 2. Definiciones actuales de las funciones que devuelven listados.
-- Revisar LIMIT solo si está dentro de una consulta que recorta el listado.
SELECT
  p.proname AS funcion,
  pg_get_function_identity_arguments(p.oid) AS argumentos,
  pg_get_function_result(p.oid) AS resultado,
  pg_get_functiondef(p.oid) AS definicion
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'obtener_alumnos', 'obtener_evaluaciones',
    'obtener_calificaciones_alumno', 'obtener_boleta_alumno',
    'obtener_calificaciones_por_matricula',
    'obtener_materias_grupo_maestro', 'obtener_lista_pase_asistencia',
    'obtener_reporte_asistencia_grupo_materia'
  )
ORDER BY p.proname, p.oid;

-- 3. Etiquetas cuyo presupuesto ya se agotó o se excedió en alguna materia
-- y periodo. Explican rechazos 400 válidos; aquí no se modifica ese presupuesto.
WITH presupuestos AS (
  SELECT
    t.grupo_materia_id, t.periodo, t.etiqueta_id,
    count(*) AS total_tareas,
    coalesce(sum(t.valor_propio), 0) AS puntos_asignados
  FROM public.tareas t
  WHERE t.etiqueta_id IS NOT NULL
  GROUP BY t.grupo_materia_id, t.periodo, t.etiqueta_id
)
SELECT
  p.grupo_materia_id, p.periodo, p.etiqueta_id,
  e.nombre AS etiqueta, p.total_tareas, e.valor_total,
  p.puntos_asignados,
  e.valor_total - p.puntos_asignados AS puntos_disponibles
FROM presupuestos p
JOIN public.etiquetas e ON e.id = p.etiqueta_id
WHERE p.puntos_asignados >= e.valor_total
ORDER BY p.grupo_materia_id, p.periodo, p.etiqueta_id;

-- 4. Duplicados que afectarían JOINs, conteos o upserts.
SELECT alumno_id, grupo_id, count(*) AS repeticiones
FROM public.alumno_grupos
GROUP BY alumno_id, grupo_id HAVING count(*) > 1;

SELECT alumno_id, tarea_id, count(*) AS repeticiones
FROM public.calificaciones
GROUP BY alumno_id, tarea_id HAVING count(*) > 1;

SELECT sesion_id, alumno_id, count(*) AS repeticiones
FROM public.asistencia_registros
GROUP BY sesion_id, alumno_id HAVING count(*) > 1;

-- 5. Índices y restricciones actuales antes de optimizar.
SELECT tablename, indexname, indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('tareas', 'alumnos', 'alumno_grupos', 'grupo_materias',
    'grupos', 'etiquetas', 'calificaciones', 'asistencia_sesiones', 'asistencia_registros')
ORDER BY tablename, indexname;
