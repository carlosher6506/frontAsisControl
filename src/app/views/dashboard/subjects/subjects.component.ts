import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MateriasService } from '../../../core/services/materias.service';
import { GrupoMateriasService } from '../../../core/services/grupo-materias.service';
import { GroupsService } from '../../../core/services/groups.service';
import { UsersService } from '../../../core/services/users.service';
import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { Materia } from '../../../core/models/subjects.model';
import { GrupoMateria } from '../../../core/models/groupSubject.model';
import { Grupo } from '../../../core/models/group.model';
import { Usuario } from '../../../core/models/user.model';

@Component({
  selector: 'app-subjects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './subjects.component.html',
  styleUrl: './subjects.component.scss'
})
export class SubjectsComponent implements OnInit {

  materias: Materia[] = [];
  grupoMaterias: GrupoMateria[] = [];
  grupos: Grupo[] = [];
  maestros: { id: number; nombre: string }[] = [];
  usuario: Usuario | null = null;

  isLoadingMaterias = true;
  isLoadingAsignaciones = true;
  isSubmittingMateria = false;
  isSubmittingAsignacion = false;
  materiaEditando: Materia | null = null;

  formMateria: FormGroup;
  formAsignacion: FormGroup;

  constructor(
    private materiasService: MateriasService,
    private grupoMateriasService: GrupoMateriasService,
    private groupsService: GroupsService,
    private usersService: UsersService,
    private authService: AuthService,
    private sweetAlert: SweetAlertService,
    private fb: FormBuilder
  ) {
    this.usuario = this.authService.getUsuario();

    this.formMateria = this.fb.group({
      nombre: ['', Validators.required]
    });

    this.formAsignacion = this.fb.group({
      grupo_id:   ['', Validators.required],
      materia_id: ['', Validators.required],
      maestro_id: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  get esAdmin(): boolean {
    return this.usuario?.rol?.toLowerCase() === 'admin';
  }

  cargarDatos(): void {
    this.isLoadingMaterias = true;
    this.isLoadingAsignaciones = true;

    // El backend ya filtra por maestro_id automáticamente
    this.materiasService.obtenerMaterias().subscribe({
      next: (data) => { this.materias = data; this.isLoadingMaterias = false; },
      error: () => { this.sweetAlert.error('Error', 'No se pudieron cargar las materias'); this.isLoadingMaterias = false; }
    });

    // El backend ya filtra por maestro_id, no necesitamos filtrar en frontend
    this.grupoMateriasService.obtenerGrupoMaterias().subscribe({
      next: (data) => { this.grupoMaterias = data; this.isLoadingAsignaciones = false; },
      error: () => { this.sweetAlert.error('Error', 'No se pudieron cargar las asignaciones'); this.isLoadingAsignaciones = false; }
    });

    // Grupos: el backend ya filtra por maestro también
    this.groupsService.obtenerGrupos().subscribe({
      next: (data) => { this.grupos = data; }
    });

    if (this.esAdmin) {
      this.usersService.obtenerUsuarios().subscribe({
        next: (data) => this.maestros = data.filter(u => u.rol === 'maestro')
      });
    } else {
      this.maestros = this.usuario ? [{ id: this.usuario.id, nombre: this.usuario.nombre }] : [];
      this.formAsignacion.get('maestro_id')!.setValue(this.usuario?.id);
    }
  }

  // ── CRUD Materia ───────────────────────────────────────────────
  guardarMateria(): void {
    if (this.formMateria.invalid) { this.formMateria.markAllAsTouched(); return; }
    this.isSubmittingMateria = true;

    if (this.materiaEditando) {
      this.materiasService.actualizarMateria(this.materiaEditando.id, this.formMateria.value).subscribe({
        next: () => {
          this.sweetAlert.toast('Materia actualizada', 'success');
          this.materiaEditando = null;
          this.formMateria.reset();
          this.cargarDatos();
          this.isSubmittingMateria = false;
        },
        error: () => { this.sweetAlert.error('Error', 'No se pudo actualizar'); this.isSubmittingMateria = false; }
      });
    } else {
      this.materiasService.crearMateria(this.formMateria.value).subscribe({
        next: () => {
          this.sweetAlert.toast('Materia creada', 'success');
          this.formMateria.reset();
          this.cargarDatos();
          this.isSubmittingMateria = false;
        },
        error: (err) => { this.sweetAlert.error('Error', err.error?.message || 'No se pudo crear'); this.isSubmittingMateria = false; }
      });
    }
  }

  editarMateria(materia: Materia): void {
    this.materiaEditando = materia;
    this.formMateria.patchValue({ nombre: materia.nombre });
  }

  cancelarEdicionMateria(): void {
    this.materiaEditando = null;
    this.formMateria.reset();
  }

  async eliminarMateria(materia: Materia): Promise<void> {
    const result = await this.sweetAlert.confirmDelete(`¿Eliminar materia "${materia.nombre}"?`);
    if (result.isConfirmed) {
      this.materiasService.eliminarMateria(materia.id).subscribe({
        next: () => { this.sweetAlert.toast('Materia eliminada', 'success'); this.cargarDatos(); },
        error: () => this.sweetAlert.error('Error', 'No se pudo eliminar')
      });
    }
  }

  getNombreCompletoGrupo(grupo: Grupo): string {
    return `${grupo.nivel_educativo || ''} ${grupo.nivel_academico || ''} ${grupo.nombre}`.trim();
  }

  // ── Asignación ─────────────────────────────────────────────────
  asignarMateria(): void {
    if (this.formAsignacion.invalid) { this.formAsignacion.markAllAsTouched(); return; }
    this.isSubmittingAsignacion = true;

    const data = {
      grupo_id:   Number(this.formAsignacion.value.grupo_id),
      materia_id: Number(this.formAsignacion.value.materia_id),
      maestro_id: Number(this.formAsignacion.value.maestro_id)
    };

    this.grupoMateriasService.asignarMateria(data).subscribe({
      next: () => {
        this.sweetAlert.toast('Materia asignada al grupo', 'success');
        this.formAsignacion.reset();
        if (!this.esAdmin) this.formAsignacion.get('maestro_id')!.setValue(this.usuario?.id);
        this.cargarDatos();
        this.isSubmittingAsignacion = false;
      },
      error: (err) => { this.sweetAlert.error('Error', err.error?.message || 'No se pudo asignar'); this.isSubmittingAsignacion = false; }
    });
  }

  async eliminarAsignacion(gm: GrupoMateria): Promise<void> {
    const result = await this.sweetAlert.confirmDelete(
      `¿Quitar "${gm.materia_nombre}" del grupo ${gm.grupo_nombre}?`
    );
    if (result.isConfirmed) {
      this.grupoMateriasService.eliminarGrupoMateria(gm.id).subscribe({
        next: () => { this.sweetAlert.toast('Asignación eliminada', 'success'); this.cargarDatos(); },
        error: () => this.sweetAlert.error('Error', 'No se pudo eliminar')
      });
    }
  }

  getNombreGrupo(grupo_id: number): string {
    const grupo = this.grupos.find(g => g.id === grupo_id);
    return grupo ? grupo.nombre : `Grupo ${grupo_id}`;
  }
}
