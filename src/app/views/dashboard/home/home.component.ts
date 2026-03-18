import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { DashboardStats } from '../../../core/models/dashboard.model';
import { Usuario } from '../../../core/models/user.model';

@Component({
  selector: 'app-home',
  imports: [CommonModule,RouterModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  usuario: Usuario | null = null;
  stats: DashboardStats | null = null;
  isLoading = true;

  modulos = [
    { label: 'Estudiantes',    icon: 'person-fill',     route: '/dashboard/students',    desc: 'Gestiona el listado de alumnos',   roles: ['admin', 'maestro'] },
    { label: 'Grupos',         icon: 'collection-fill', route: '/dashboard/groups',      desc: 'Administra grupos y secciones',    roles: ['admin', 'maestro'] },
    { label: 'Evaluaciones',   icon: 'clipboard-check', route: '/dashboard/evaluations', desc: 'Crea y revisa evaluaciones',       roles: ['admin', 'maestro'] },
    { label: 'Tareas',         icon: 'journal-check',   route: '/dashboard/tasks',       desc: 'Control de tareas asignadas',      roles: ['admin', 'maestro'] },
    { label: 'Calificaciones', icon: 'star-fill',       route: '/dashboard/ratings',     desc: 'Registro de calificaciones',       roles: ['admin', 'maestro'] },
    { label: 'Año Escolar',    icon: 'calendar-fill',   route: '/dashboard/schoolYear',  desc: 'Configuración del año escolar',    roles: ['admin'] },
    { label: 'Usuarios',       icon: 'people-fill',     route: '/dashboard/users',       desc: 'Gestión de usuarios del sistema',  roles: ['admin'] },
  ];

  constructor(
    private authService: AuthService,
    private dashboardService: DashboardService,
    private sweetAlert: SweetAlertService
  ){
    this.usuario = this.authService.getUsuario();
  }

  ngOnInit(): void {
    this.cargarStats();
  }

  get modulosFiltrados(){
    const rol = this.usuario?.rol?.toLowerCase() || '';
    return this.modulos.filter(m => m.roles.includes(rol));
  }

  cargarStats(): void {
    this.isLoading = true;

    this.dashboardService.getStats().subscribe({
      next: (data) =>{
        this.stats = data;
        this.isLoading = false;
      },
      error: () => {
        this.sweetAlert.error('Error', 'No se pudieron cargar las estadísticas');
        this.isLoading = false;
      }
    });
  }

  getSaludo(): string{
    const hora = new Date().getHours();
    if (hora < 12) return 'Buenos días';
    if (hora < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }
}
