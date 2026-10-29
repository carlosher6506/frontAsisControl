-- Optimización de consultas revisada contra el esquema compartido.
-- Ejecutar en el SQL Editor del proyecto correspondiente.
-- Conserva registros, funciones, secuencias y reglas de calificación.
-- Comprueba índices existentes por sus columnas para evitar duplicarlos
-- aunque tengan otro nombre. Todo el cambio se aplica en una transacción.

BEGIN;

DO $indices$
DECLARE
  objetivo record;
  columnas_sql text;
  creados integer := 0;
BEGIN
  FOR objetivo IN
    SELECT * FROM (VALUES
      ('tareas', 'idx_tareas_gm_periodo_fecha_id',
        ARRAY['grupo_materia_id', 'periodo', 'fecha', 'id']::text[]),
      ('tareas', 'idx_tareas_gm_etiqueta_periodo',
        ARRAY['grupo_materia_id', 'etiqueta_id', 'periodo']::text[]),
      ('alumno_grupos', 'idx_alumno_grupos_grupo_alumno',
        ARRAY['grupo_id', 'alumno_id']::text[]),
      ('alumno_grupos', 'idx_alumno_grupos_alumno_grupo',
        ARRAY['alumno_id', 'grupo_id']::text[]),
      ('grupo_materias', 'idx_grupo_materias_maestro_id',
        ARRAY['maestro_id', 'id']::text[]),
      ('grupos', 'idx_grupos_maestro_id',
        ARRAY['maestro_id', 'id']::text[]),
      ('etiquetas', 'idx_etiquetas_configuracion_id',
        ARRAY['configuracion_id', 'id']::text[]),
      ('calificaciones', 'idx_calificaciones_alumno_tarea',
        ARRAY['alumno_id', 'tarea_id']::text[])
    ) AS candidatos(tabla, nombre, columnas)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_index i
      JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
      JOIN pg_catalog.pg_class ix ON ix.oid = i.indexrelid
      JOIN pg_catalog.pg_am am ON am.oid = ix.relam
      JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = objetivo.tabla
        AND am.amname = 'btree'
        AND i.indisvalid
        AND i.indisready
        AND i.indpred IS NULL
        AND i.indexprs IS NULL
        AND i.indnkeyatts >= cardinality(objetivo.columnas)
        AND ARRAY(
          SELECT a.attname::text
          FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS k(numero, posicion)
          JOIN pg_catalog.pg_attribute a
            ON a.attrelid = t.oid AND a.attnum = k.numero
          WHERE k.posicion <= cardinality(objetivo.columnas)
          ORDER BY k.posicion
        ) = objetivo.columnas
    ) THEN
      IF to_regclass(format('%I.%I', 'public', objetivo.nombre)) IS NOT NULL THEN
        RAISE EXCEPTION 'Ya existe % con otra definición; revisar antes de crear índices', objetivo.nombre;
      END IF;

      SELECT string_agg(format('%I', columna), ', ' ORDER BY posicion)
      INTO columnas_sql
      FROM unnest(objetivo.columnas) WITH ORDINALITY AS c(columna, posicion);

      EXECUTE format('CREATE INDEX %I ON %I.%I (%s)',
        objetivo.nombre, 'public', objetivo.tabla, columnas_sql);
      creados := creados + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Índices nuevos: %; los índices equivalentes existentes se conservaron', creados;
END;
$indices$;

COMMIT;
