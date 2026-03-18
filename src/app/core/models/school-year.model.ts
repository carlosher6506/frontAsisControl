export interface CicloEscolar {
  id: number;
  nombre: string;
  activo: boolean;
  fecha_inicio: string;
  fecha_fin: string;
}

export interface CrearCiclo {
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
}

export interface ActualizarCiclo {
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
}
