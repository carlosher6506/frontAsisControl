import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { GroupsService } from '../../../core/services/groups.service';
import { SchoolYearService } from '../../../core/services/school-year.service';
import { AcademicLevelsService } from '../../../core/services/academic-levels.service';
import { EducationLevelsService } from '../../../core/services/education-levels.service';
import { UsersService } from '../../../core/services/users.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { Grupo, CrearGrupo, ActualizarGrupo } from '../../../core/models/group.model';
import { CicloEscolar } from '../../../core/models/school-year.model';
import { NivelAcademico } from '../../../core/models/academic-level.model';
import { NivelEducativo } from '../../../core/models/education-level.model';
import { Usuario } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { StudentsService } from '../../../core/services/students.service';
import { Alumno } from '../../../core/models/student.model';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './groups.component.html',
  styleUrl: './groups.component.scss'
})
export class GroupsComponent implements OnInit {

  grupos: Grupo[] = [];
  ciclos: CicloEscolar[] = [];
  nivelesEducativos: NivelEducativo[] = [];
  nivelesAcademicos: NivelAcademico[] = [];
  maestros: Usuario[] = [];
  form: FormGroup;
  alumnosDelGrupo: Alumno[] = [];
  grupoViendoAlumnos: Grupo | null = null;
  cargandoAlumnos = false;

  isLoading = true;
  isSubmitting = false;
  modoEdicion = false;
  grupoSeleccionado: Grupo | null = null;
  textoBusqueda = '';

  nivelEducativoSeleccionado: number | null = null;
  nivelAcademicoSeleccionado: number | null = null;

  get esAdmin(): boolean {
    return this.usuario?.rol?.toLowerCase() === 'admin';
  }

  get nivelesAcademicosFiltrados(): NivelAcademico[] {
    if (!this.nivelEducativoSeleccionado) return [];
    return this.nivelesAcademicos.filter(
      na => na.nivel_educativo_id === Number(this.nivelEducativoSeleccionado) // ← agrega Number()
    );
  }

  usuario: any = null;
  constructor(
    private groupsService: GroupsService,
    private schoolYearService: SchoolYearService,
    private academicLevelsService: AcademicLevelsService,
    private educationLevelsService: EducationLevelsService,
    private usersService: UsersService,
    private authService: AuthService,
    private sweetAlert: SweetAlertService,
    private fb: FormBuilder,
    private studentsService: StudentsService
  ) {
    this.usuario = this.authService.getUsuario();
    this.form = this.fb.group({
      nombre:             ['', Validators.required],
      ciclo_escolar_id:   ['', Validators.required],
      maestro_id:         ['', Validators.required],
      nivel_academico_id: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    if (!this.esAdmin) {
      this.form.get('maestro_id')!.clearValidators();
      this.form.get('maestro_id')!.updateValueAndValidity();
    }
    this.cargarDatos();
  }

  // ------ Getters ------
  get nombre()             { return this.form.get('nombre')!; }
  get ciclo_escolar_id()   { return this.form.get('ciclo_escolar_id')!; }
  get maestro_id()         { return this.form.get('maestro_id')!; }
  get nivel_academico_id() { return this.form.get('nivel_academico_id')!; }

  // ------ Búsqueda ------
  get gruposFiltrados(): Grupo[] {
    if (!this.textoBusqueda.trim()) return this.grupos;
    const texto = this.textoBusqueda.toLowerCase();
    return this.grupos.filter(g =>
      g.nombre.toLowerCase().includes(texto) ||
      this.getNombreNivel(g.nivel_academico_id).toLowerCase().includes(texto)
    );
  }

  // ------ Helpers para mostrar nombres ------
  getNombreNivel(nivel_academico_id: number): string {
    const nivel = this.nivelesAcademicos.find(n => n.id === nivel_academico_id);
    return nivel ? `${nivel.nivel_educativo} - ${nivel.nombre} Grado/Semestre` : `Nivel ${nivel_academico_id}`;
  }

  getNombreCiclo(ciclo_id: number): string {
    const ciclo = this.ciclos.find(c => c.id === ciclo_id);
    return ciclo ? ciclo.nombre : `Ciclo ${ciclo_id}`;
  }

  getNombreMaestro(maestro_id: number): string {
    const maestro = this.maestros.find(m => m.id === maestro_id);
    if (maestro) return maestro.nombre;

    if (!this.esAdmin && this.usuario?.id === maestro_id) {
      return this.usuario.nombre;
    }

    return `Maestro ${maestro_id}`;
  }

  // ------ Cargar datos ------
  cargarDatos(): void {
    this.isLoading = true;
    this.groupsService.obtenerGrupos().subscribe({
      next: (data) => { this.grupos = data; this.isLoading = false; },
      error: () => { this.sweetAlert.error('Error', 'No se pudieron cargar los grupos'); this.isLoading = false; }
    });
    this.schoolYearService.obtenerCiclos().subscribe({
      next: (data) => this.ciclos = data
    });
    this.educationLevelsService.obtenerNiveles().subscribe({
      next: (data) => this.nivelesEducativos = data
    });
    this.academicLevelsService.obtenerNiveles().subscribe({
      next: (data) => this.nivelesAcademicos = data
    });

    if (this.esAdmin) {
      this.usersService.obtenerUsuarios().subscribe({
        next: (data) => this.maestros = data.filter(u => u.rol === 'maestro')
      });
    } else {
      if (this.usuario) {
        this.maestros = [this.usuario];
      }
    }
  }

  // ------ Cambios en selects encadenados ------
  onNivelEducativoChange(): void {
    this.nivelAcademicoSeleccionado = null;
    this.form.get('nivel_academico_id')!.setValue('');
  }

  // ------ Abrir modal crear ------
  abrirModalCrear(): void {
    this.modoEdicion = false;
    this.grupoSeleccionado = null;
    this.nivelEducativoSeleccionado = null;
    this.nivelAcademicoSeleccionado = null;
    this.form.reset();
  }

  // ------ Abrir modal editar ------
  abrirModalEditar(grupo: Grupo): void {
    this.modoEdicion = true;
    this.grupoSeleccionado = grupo;
    this.form.patchValue({
      nombre:     grupo.nombre,
      maestro_id: grupo.maestro_id
    });
  }

  // ------ Guardar ------
  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;

    // Si es maestro, usa su propio ID
    const maestroId = this.esAdmin
      ? Number(this.form.value.maestro_id)
      : this.usuario!.id;

    if (this.modoEdicion && this.grupoSeleccionado) {
      const data: ActualizarGrupo = {
        nombre:     this.form.value.nombre,
        maestro_id: maestroId
      };
      this.groupsService.actualizarGrupo(this.grupoSeleccionado.id, data).subscribe({
        next: () => { this.sweetAlert.toast('Grupo actualizado', 'success'); this.cerrarModal(); this.cargarDatos(); this.isSubmitting = false; },
        error: () => { this.sweetAlert.error('Error', 'No se pudo actualizar'); this.isSubmitting = false; }
      });
    } else {
      const data: CrearGrupo = {
        nombre:             this.form.value.nombre,
        ciclo_escolar_id:   Number(this.form.value.ciclo_escolar_id),
        maestro_id:         maestroId,
        nivel_academico_id: Number(this.form.value.nivel_academico_id)
      };
      this.groupsService.crearGrupo(data).subscribe({
        next: () => { this.sweetAlert.toast('Grupo creado', 'success'); this.cerrarModal(); this.cargarDatos(); this.isSubmitting = false; },
        error: () => { this.sweetAlert.error('Error', 'No se pudo crear el grupo'); this.isSubmitting = false; }
      });
    }
  }

  // ------ Eliminar ------
  async eliminar(grupo: Grupo): Promise<void> {
    const result = await this.sweetAlert.confirmDelete(
      `¿Eliminar el grupo ${grupo.nombre}?`,
      'Se eliminarán también los alumnos asociados'
    );
    if (result.isConfirmed) {
      this.groupsService.eliminarGrupo(grupo.id).subscribe({
        next: () => { this.sweetAlert.toast('Grupo eliminado', 'success'); this.cargarDatos(); },
        error: () => this.sweetAlert.error('Error', 'No se pudo eliminar el grupo')
      });
    }
  }

  verAlumnos(grupo: Grupo): void {
    this.grupoViendoAlumnos = grupo;
    this.alumnosDelGrupo = [];
    this.cargandoAlumnos = true;

    this.studentsService.obtenerAlumnosPorGrupo(grupo.id).subscribe({
      next: (data) => {
        this.alumnosDelGrupo = data;
        this.cargandoAlumnos = false;
      },
      error: () => {
        this.sweetAlert.error('Error', 'No se pudieron cargar los alumnos');
        this.cargandoAlumnos = false;
      }
    });
  }

  // ------ Cerrar modal ------
  cerrarModal(): void {
    this.form.reset();
    this.modoEdicion = false;
    this.grupoSeleccionado = null;
    this.nivelEducativoSeleccionado = null;
    this.nivelAcademicoSeleccionado = null;
    const modal = document.getElementById('modalGrupo');
    if (modal) (window as any).bootstrap.Modal.getInstance(modal)?.hide();
  }
}
