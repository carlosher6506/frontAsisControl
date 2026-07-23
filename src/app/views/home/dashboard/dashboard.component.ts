import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { Usuario } from '../../../core/models/user.model';
import { MenuItem } from '../../../core/models/dashboard.model';


@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  sidebarOpen = false;
  usuario: Usuario | null = null;

  menuItems: MenuItem[] = [
    { label: 'Inicio',          icon: 'house-fill',         route: '/dashboard',                roles: ['admin', 'maestro'] },
    { label: 'Usuarios',        icon: 'people-fill',        route: '/dashboard/users',          roles: ['admin'] },
    { label: 'Estudiantes',     icon: 'person-fill',        route: '/dashboard/students',       roles: ['admin', 'maestro'] },
    { label: 'Grupos',          icon: 'collection-fill',    route: '/dashboard/groups',         roles: ['admin', 'maestro'] },
    { label: 'Materias',        icon: 'book-fill',          route: '/dashboard/subjects',       roles: ['admin', 'maestro'] },
    { label: 'Evaluaciones',    icon: 'clipboard-check',    route: '',                          roles: ['admin', 'maestro'],   open: false,
      children:[
        { label: 'Tipo Evaluación',    icon: 'gear-fill',           route: '/dashboard/evaluations',     roles: ['admin', 'maestro']},
        { label: 'Crear Tareas',       icon: 'journal-check',       route: '/dashboard/tasks',           roles: ['admin', 'maestro'] },
        { label: 'Calificaciones',     icon: 'star-fill',           route: '/dashboard/ratings',         roles: ['admin', 'maestro'] }
      ]
    },
    { label: 'Ajuste Escolar',  icon: 'gear-fill',          route: '',                          roles: ['admin', 'maestro'],   open: false,
      children:[
        { label: 'Ciclo Escolar',      icon: 'calendar-fill',      route: '/dashboard/schoolYear',     roles: ['admin'] },
        { label: 'Ajustes Niveles',    icon: 'bar-chart-fill',     route: '/dashboard/levels',         roles: ['admin'] },
      ]
    },
    { label: 'Mi perfil',       icon: 'person-circle',      route: '/dashboard/profile',        roles: ['admin', 'maestro'] },
  ];

  constructor(
    private authService: AuthService,
    private sweetAlert: SweetAlertService,
    private router: Router
  ){
    this.usuario = this.authService.getUsuario();
  }

  get menuFiltrado(): MenuItem[]{
    const rol = this.usuario?.rol?.toLowerCase() || '';
    return this.menuItems.filter(item => item.roles.includes(rol));
  }

  toggleSidebar(): void{
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleMenu(item: MenuItem): void {
    item.open = !item.open;
  }

  async logout(): Promise<void>{
    const result = await this.sweetAlert.confirm(
      '¿Cerrar sesión?',
      '¿Estás seguro que deseas salir del sistema?',
      'Sí, cerrar sesión',
      'Cancelar'
    );
    if (result.isConfirmed){
      this.authService.logout();
      this.sweetAlert.toast('Sesión cerrada correctamente', 'success');
      this.router.navigate(['/login']);
    }
  }
}
