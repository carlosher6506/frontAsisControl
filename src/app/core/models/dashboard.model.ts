export interface MenuItem {
  label: string;
  icon: string;
  route: string;
  roles: string[];
}

export interface DashboardStats {
  totalEstudiantes: number;
  totalGrupos: number;
  totalEvaluaciones: number;
  totalTareas: number;
  totalUsuarios: number;
}
