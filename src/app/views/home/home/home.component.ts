import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, ViewChildren, QueryList, viewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { DashboardStats } from '../../../core/models/dashboard.model';
import { Usuario } from '../../../core/models/user.model';

declare var Chart: any;

@Component({
  selector: 'app-home',
  imports: [ CommonModule, RouterModule, DatePipe ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, AfterViewInit {

  @ViewChild('chartActividad') chartActividadRef!: ElementRef;
  @ViewChild('chartModulos')   chartModulosRef!: ElementRef;
  @ViewChild('chartBarras') chartBarrasRef!: ElementRef;

  usuario: Usuario | null = null;
  stats: DashboardStats | null = null;
  isLoading = true;
  chartsCargados = false;

  usuariosActividad: any[] = [];
  resumenActividad: any    = null;
  actividadSemanal: any    = null;
  cargandoAdmin            = true;

  modulos = [
    { label: 'Usuarios',       icon: 'people-fill',     route: '/dashboard/users',       desc: 'Gestión de usuarios del sistema',  roles: ['admin'] },
    { label: 'Estudiantes',    icon: 'person-fill',     route: '/dashboard/students',    desc: 'Gestiona el listado de alumnos',   roles: ['admin', 'maestro'] },
    { label: 'Grupos',         icon: 'collection-fill', route: '/dashboard/groups',      desc: 'Administra grupos y secciones',    roles: ['admin', 'maestro'] },
    { label: 'Tareas',         icon: 'journal-check',   route: '/dashboard/tasks',       desc: 'Control de tareas asignadas',      roles: ['admin', 'maestro'] },
  ];

  constructor(
    private authService: AuthService,
    private dashboardService: DashboardService,
    private sweetAlert: SweetAlertService
  ){
    this.usuario = this.authService.getUsuario();
  }

  get esAdmin(): boolean {
    return this.usuario?.rol?.toLowerCase() === 'admin';
  }

  get modulosFiltrados(){
    const rol = this.usuario?.rol?.toLowerCase() || '';
    return this.modulos.filter(m => m.roles.includes(rol));
  }

  ngOnInit(): void {
    this.cargarStats();
    this.cargarChartJS();
    if (this.esAdmin) this.cargarDatosAdmin();
  }

  ngAfterViewInit(): void {
    // Las gráficas se inicializan después de que los stats carguen
  }

  cargarChartJS(): void {
    if (typeof Chart !== 'undefined' || !this.esAdmin) return;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    document.head.appendChild(script);
  }

  cargarStats(): void {
    this.isLoading = true;
    this.dashboardService.getStats().subscribe({
      next:  (data) => { this.stats = data; this.isLoading = false; },
      error: () => {
        this.sweetAlert.error('Error', 'No se pudieron cargar las estadísticas');
        this.isLoading = false;
      }
    });
  }

  cargarDatosAdmin(): void {
    this.cargandoAdmin = true;

    // Actividad semanal → alimenta la gráfica de línea
    this.dashboardService.getActividadSemanal().subscribe({
      next: (data) => {
        this.actividadSemanal = data;
        this.intentarInicializarGraficas();
      },
      error: () => console.error('Error cargando actividad semanal')
    });

    // Tabla de usuarios con actividad → alimenta gráfica de dona + tabla
    this.dashboardService.getUsuariosActividad().subscribe({
      next: (data) => {
        this.usuariosActividad = data.usuarios;
        this.resumenActividad  = data.resumen;
        this.cargandoAdmin     = false;
        this.intentarInicializarGraficas();
      },
      error: () => {
        this.sweetAlert.error('Error', 'No se pudo cargar la actividad de usuarios');
        this.cargandoAdmin = false;
      }
    });
  }

  private intentarInicializarGraficas(): void {
    if (!this.actividadSemanal || !this.resumenActividad) return;

    const init = () => {
      if (typeof Chart === 'undefined') {
        setTimeout(init, 150);
        return;
      }
      this.buildChartActividad();
      this.buildChartBarras();
      this.recalcularResumen();
      this.buildChartModulos();
    };
    setTimeout(init, 100);
  }

  private buildChartActividad(): void {
    const canvas = this.chartActividadRef?.nativeElement;
    if (!canvas || !this.actividadSemanal) return;

    new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: this.actividadSemanal.labels,
        datasets: [{
          label: 'Usuarios activos',
          data:  this.actividadSemanal.data,
          borderColor: '#008dceb9',
          backgroundColor: 'rgba(0,141,206,0.08)',
          borderWidth: 2,
          pointBackgroundColor: '#008dceb9',
          pointRadius: 4,
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  private buildChartBarras(): void {
    const canvas = this.chartBarrasRef?.nativeElement;
    if (!canvas || !this.usuariosActividad.length) return;

    const colores: any = { activo: '#639922', poco_activo: '#EF9F27', inactivo: '#E24B4A', nunca: '#B4B2A9' };

    new Chart(canvas.getContext('2d')!, {
      type: 'bar',
      data: {
        labels: this.usuariosActividad.map((u: any) => u.nombre.split(' ')[0]),
        datasets: [{
          label: 'Total logins',
          data: this.usuariosActividad.map((u: any) => u.totalLogins),
          backgroundColor: this.usuariosActividad.map((u: any) => colores[u.estado] || '#B4B2A9'),
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 5, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
          x: { ticks: { font: { size: 11 } }, grid: { display: false }, border: { display: false } }
        }
      }
    });
  }

  private buildChartModulos(): void {
    const canvas = this.chartModulosRef?.nativeElement;
    if (!canvas || !this.resumenActividad) return;

    new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Activos', 'Poco activos', 'Inactivos', 'Nunca'],
        datasets: [{
          data: [
            this.resumenActividad.activos,
            this.resumenActividad.pocoActivos,
            this.resumenActividad.inactivos,
            this.resumenActividad.nunca
          ],
          backgroundColor: [
            '#639922',
            '#EF9F27',
            '#E24B4A',
            '#B4B2A9'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  private recalcularResumen() {
    return {
      activos:     this.usuariosActividad.filter(u => u.estado === 'activo').length,
      pocoActivos: this.usuariosActividad.filter(u => u.estado === 'poco_activo').length,
      inactivos:   this.usuariosActividad.filter(u => u.estado === 'inactivo').length,
      nunca:       this.usuariosActividad.filter(u => u.estado === 'nunca').length,
    };
  }

  getBarraActividad(totalLogins: number): number {
    const max = Math.max(...this.usuariosActividad.map((u: any) => u.totalLogins), 1);
    return Math.round((totalLogins / max) * 100);
  }

  getColorBarra(estado: string): string {
    const map: any = { activo: '#639922', poco_activo: '#EF9F27', inactivo: '#E24B4A', nunca: '#B4B2A9' };
    return map[estado] || '#B4B2A9';
  }

  getColorFondo(estado: string): string {
    const map: any = { activo: '#EAF3DE', poco_activo: '#FAEEDA', inactivo: '#FCEBEB', nunca: '#F1EFE8' };
    return map[estado] || '#F1EFE8';
  }

  getColorTexto(estado: string): string {
    const map: any = { activo: '#27500A', poco_activo: '#633806', inactivo: '#791F1F', nunca: '#444441' };
    return map[estado] || '#444441';
  }

  getEtiqueta(estado: string): string {
    const map: any = { activo: 'Activo', poco_activo: 'Poco activo', inactivo: 'Inactivo', nunca: 'Nunca' };
    return map[estado] || estado;
  }

  getIniciales(nombre: string): string {
    return nombre.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
  }

  getSaludo(): string{
    const hora = new Date().getHours();
    if (hora < 12) return 'Buenos días';
    if (hora < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }
}
