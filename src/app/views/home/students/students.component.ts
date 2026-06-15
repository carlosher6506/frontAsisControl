import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { StudentsService } from '../../../core/services/students.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { Alumno, CrearAlumno } from '../../../core/models/student.model';
import { GroupsService } from '../../../core/services/groups.service';
import { EducationLevelsService } from '../../../core/services/education-levels.service';
import { AcademicLevelsService } from '../../../core/services/academic-levels.service';
import { Grupo } from '../../../core/models/group.model';
import { NivelEducativo } from '../../../core/models/education-level.model';
import { NivelAcademico } from '../../../core/models/academic-level.model';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './students.component.html',
  styleUrl: './students.component.scss'
})
export class StudentsComponent implements OnInit {

  alumnos: Alumno[] = [];
  grupos: Grupo[] = [];
  nivelesEducativos: NivelEducativo[] = [];
  nivelesAcademicos: NivelAcademico[] = [];

  nivelEducativoSeleccionado: number | null = null;
  nivelAcademicoSeleccionado: number | null = null;

  // Grupos seleccionados en edición (múltiple)
  gruposSeleccionados: number[] = [];

  isLoading = true;
  isSubmitting = false;
  modoEdicion = false;
  alumnoSeleccionado: Alumno | null = null;
  textoBusqueda = '';

  alumnosExcel: { nombre: string; matricula: string; grupo: string }[] = [];
  importando = false;

  form: FormGroup;

  constructor(
    private studentsService: StudentsService,
    private groupsService: GroupsService,
    private educationLevelsService: EducationLevelsService,
    private academicLevelsService: AcademicLevelsService,
    private sweetAlert: SweetAlertService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      nombre:    ['', [Validators.required, Validators.minLength(3)]],
      matricula: ['', Validators.required],
      grupo_id:  ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  get nombre()    { return this.form.get('nombre')!; }
  get matricula() { return this.form.get('matricula')!; }
  get grupo_id()  { return this.form.get('grupo_id')!; }

  get alumnosFiltrados(): Alumno[] {
    if (!this.textoBusqueda.trim()) return this.alumnos;
    const texto = this.textoBusqueda.toLowerCase();
    return this.alumnos.filter(a =>
      a.nombre.toLowerCase().includes(texto) ||
      a.matricula?.toLowerCase().includes(texto)
    );
  }

  get nivelesAcademicosFiltrados(): NivelAcademico[] {
    if (!this.nivelEducativoSeleccionado) return [];
    return this.nivelesAcademicos.filter(
      na => na.nivel_educativo_id === Number(this.nivelEducativoSeleccionado)
    );
  }

  get gruposFiltrados(): Grupo[] {
    if (!this.nivelAcademicoSeleccionado) return [];
    return this.grupos.filter(
      g => g.nivel_academico_id === Number(this.nivelAcademicoSeleccionado)
    );
  }

  cargarDatos(): void {
    this.isLoading = true;
    this.studentsService.obtenerAlumnos().subscribe({
      next: (data) => { this.alumnos = data; this.isLoading = false; },
      error: () => { this.sweetAlert.error('Error', 'No se pudieron cargar los alumnos'); this.isLoading = false; }
    });
    this.groupsService.obtenerGrupos().subscribe({ next: (data) => this.grupos = data });
    this.educationLevelsService.obtenerNiveles().subscribe({ next: (data) => this.nivelesEducativos = data });
    this.academicLevelsService.obtenerNiveles().subscribe({ next: (data) => this.nivelesAcademicos = data });
  }

  onNivelEducativoChange(): void {
    this.nivelAcademicoSeleccionado = null;
    this.form.get('grupo_id')!.setValue('');
    this.gruposSeleccionados = [];
  }

  onNivelAcademicoChange(): void {
    this.form.get('grupo_id')!.setValue('');
    this.gruposSeleccionados = [];
  }

  // Toggle selección de grupo en modo edición
  toggleGrupo(grupoId: number): void {
    const idx = this.gruposSeleccionados.indexOf(grupoId);
    if (idx === -1) {
      this.gruposSeleccionados.push(grupoId);
    } else {
      this.gruposSeleccionados.splice(idx, 1);
    }
  }

  isGrupoSeleccionado(grupoId: number): boolean {
    return this.gruposSeleccionados.includes(grupoId);
  }

  abrirModalCrear(): void {
    this.modoEdicion = false;
    this.alumnoSeleccionado = null;
    this.nivelEducativoSeleccionado = null;
    this.nivelAcademicoSeleccionado = null;
    this.gruposSeleccionados = [];
    this.form.reset();
    // Restaurar validadores para creación
    this.form.get('matricula')!.setValidators(Validators.required);
    this.form.get('grupo_id')!.setValidators(Validators.required);
    this.form.get('matricula')!.updateValueAndValidity();
    this.form.get('grupo_id')!.updateValueAndValidity();
  }

  abrirModalEditar(alumno: Alumno): void {
    this.modoEdicion = true;
    this.alumnoSeleccionado = alumno;
    this.gruposSeleccionados = [];

    // Quitar validadores que no aplican en edición
    this.form.get('matricula')!.clearValidators();
    this.form.get('grupo_id')!.clearValidators();
    this.form.get('matricula')!.updateValueAndValidity();
    this.form.get('grupo_id')!.updateValueAndValidity();

    this.form.patchValue({
      nombre:    alumno.nombre,
      matricula: alumno.matricula
    });

    // Precargar nivel educativo/académico del alumno para mostrar grupos disponibles
    if (alumno.grupo_id) {
      const grupo = this.grupos.find(g => g.id === alumno.grupo_id);
      if (grupo) {
        const nivelAcademico = this.nivelesAcademicos.find(na => na.id === grupo.nivel_academico_id);
        if (nivelAcademico) {
          this.nivelEducativoSeleccionado = nivelAcademico.nivel_educativo_id;
          this.nivelAcademicoSeleccionado = nivelAcademico.id;
        }
      }
    }

    // Cargar grupos actuales del alumno
    this.studentsService.obtenerGruposDeAlumno(alumno.id).subscribe({
      next: (grupos) => {
        this.gruposSeleccionados = grupos.map((g: any) => g.id);
      },
      error: () => {
        // Si falla, al menos marcar el grupo principal
        if (alumno.grupo_id) this.gruposSeleccionados = [alumno.grupo_id];
      }
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;

    if (this.modoEdicion && this.alumnoSeleccionado) {
      if (this.gruposSeleccionados.length === 0) {
        this.sweetAlert.error('Error', 'Debes seleccionar al menos un grupo');
        this.isSubmitting = false;
        return;
      }

      const data = {
        nombre:    this.form.value.nombre,
        matricula: this.form.value.matricula || this.alumnoSeleccionado.matricula,
        grupo_id:  this.gruposSeleccionados[0],
        grupo_ids: this.gruposSeleccionados
      };

      this.studentsService.actualizarAlumno(this.alumnoSeleccionado.id, data).subscribe({
        next: () => {
          this.sweetAlert.toast('Alumno actualizado', 'success');
          this.cerrarModal();
          this.cargarDatos();
          this.isSubmitting = false;
        },
        error: (err) => {
          this.sweetAlert.error('Error', err?.error?.message || 'No se pudo actualizar');
          this.isSubmitting = false;
        }
      });
    } else {
      const data: CrearAlumno = {
        nombre:    this.form.value.nombre,
        matricula: this.form.value.matricula,
        grupo_id:  Number(this.form.value.grupo_id)
      };
      this.studentsService.crearAlumno(data).subscribe({
        next: () => {
          this.sweetAlert.toast('Alumno creado', 'success');
          this.cerrarModal();
          this.cargarDatos();
          this.isSubmitting = false;
        },
        error: () => { this.sweetAlert.error('Error', 'No se pudo crear el alumno'); this.isSubmitting = false; }
      });
    }
  }

  async eliminar(alumno: Alumno): Promise<void> {
    const result = await this.sweetAlert.confirmDelete(`¿Eliminar a ${alumno.nombre}?`);
    if (result.isConfirmed) {
      this.studentsService.eliminarAlumno(alumno.id).subscribe({
        next: () => { this.sweetAlert.toast('Alumno eliminado', 'success'); this.cargarDatos(); },
        error: () => this.sweetAlert.error('Error', 'No se pudo eliminar')
      });
    }
  }

  onArchivoExcel(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);
      this.alumnosExcel = rows.map(r => ({
        nombre:    r['nombre']    || r['Nombre']    || '',
        matricula: r['matricula'] || r['Matricula'] || '',
        grupo:     r['grupo']     || r['Grupo']     || ''
      })).filter(r => r.nombre);
    };
    reader.readAsArrayBuffer(input.files[0]);
  }

  async importarExcel(): Promise<void> {
    if (!this.alumnosExcel.length) return;
    const result = await this.sweetAlert.confirm(`¿Importar ${this.alumnosExcel.length} alumnos?`, '');
    if (!result.isConfirmed) return;

    this.importando = true;
    this.sweetAlert.loading('Importando...', 'Creando alumnos');
    let exitosos = 0, fallidos = 0;

    for (const alumno of this.alumnosExcel) {
      const grupo = this.grupos.find(g => g.nombre.toLowerCase() === alumno.grupo.toLowerCase());
      if (!grupo) { fallidos++; continue; }
      try {
        await new Promise<void>((resolve, reject) => {
          this.studentsService.crearAlumno({ nombre: alumno.nombre, matricula: alumno.matricula, grupo_id: grupo.id })
            .subscribe({ next: () => resolve(), error: () => reject() });
        });
        exitosos++;
      } catch { fallidos++; }
    }

    this.sweetAlert.closeLoading();
    this.importando = false;
    this.alumnosExcel = [];
    if (fallidos === 0) {
      this.sweetAlert.success('¡Importación exitosa!', `${exitosos} alumnos creados`);
    } else {
      this.sweetAlert.warning('Importación parcial', `${exitosos} creados, ${fallidos} fallaron`);
    }
    this.cargarDatos();
    this.cerrarModalExcel();
  }

  descargarPlantilla(): void {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['nombre', 'matricula', 'grupo'],
      ['Juan Pérez', '2024001', 'A'],
      ['María García', '2024002', 'B'],
    ]);
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');
    XLSX.writeFile(wb, 'plantilla_alumnos.xlsx');
  }

  cerrarModal(): void {
    this.form.reset();
    this.modoEdicion = false;
    this.alumnoSeleccionado = null;
    this.nivelEducativoSeleccionado = null;
    this.nivelAcademicoSeleccionado = null;
    this.gruposSeleccionados = [];
    const modal = document.getElementById('modalAlumno');
    if (modal) (window as any).bootstrap.Modal.getInstance(modal)?.hide();
  }

  cerrarModalExcel(): void {
    this.alumnosExcel = [];
    const modal = document.getElementById('modalExcel');
    if (modal) (window as any).bootstrap.Modal.getInstance(modal)?.hide();
  }
}
