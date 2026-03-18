export interface StatCard {
  label: string;
  value: number;
  icon: string;
  color: string;
}

export interface Actividad {
  descripcion: string;
  fecha: string;
  tipo: 'success' | 'warning' | 'info' | 'danger';
}
