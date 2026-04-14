export interface Etiqueta {
  id: number;
  configuracion_id: number;
  nombre: string;
  valor_total: number;
  grupo_id?: number;
  tipo_evaluacion?: string;
}

export interface CrearEtiqueta {
  configuracion_id: number;
  nombre: string;
  valor_total: number;
}
