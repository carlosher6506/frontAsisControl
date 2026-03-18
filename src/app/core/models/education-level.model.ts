export interface NivelEducativo {
  id: number;
  nombre: string;
  tipo_estructura: 'grado' | 'semestre';
  calificacion_minima_aprobatoria: number;
  forzar_minimo: boolean;
}

export interface CrearNivelEducativo {
  nombre: string;
  tipo_estructura: 'grado' | 'semestre';
  calificacion_minima_aprobatoria: number;
  forzar_minimo: boolean;
}
