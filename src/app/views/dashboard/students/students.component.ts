import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { StudentsService } from '../../../core/services/students.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { Alumno, CrearAlumno, ActualizarAlumno } from '../../../core/models/student.model';
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

  // Selects encadenados
  nivelEducativoSeleccionado: number | null = null;
  nivelAcademicoSeleccionado: number | null = null;

  // Filtrados por selección
  get nivelesAcademicosFiltrados(): NivelAcademico[] {
    if (!this.nivelEducativoSeleccionado) return [];
    return this.nivelesAcademicos.filter(
      na => na.nivel_educativo_id === Number(this.nivelEducativoSeleccionado) // ← agrega Number()
    );
  }

  get gruposFiltrados(): Grupo[] {
    if (!this.nivelAcademicoSeleccionado) return [];
    return this.grupos.filter(
      g => g.nivel_academico_id === Number(this.nivelAcademicoSeleccionado) // ← agrega Number()
    );
  }

  isLoading = true;
  isSubmitting = false;
  modoEdicion = false;
  alumnoSeleccionado: Alumno | null = null;
  textoBusqueda = '';

  // Excel
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

  // ------ Getters form ------
  get nombre()    { return this.form.get('nombre')!; }
  get matricula() { return this.form.get('matricula')!; }
  get grupo_id()  { return this.form.get('grupo_id')!; }

  // ------ Filtro búsqueda ------
  get alumnosFiltrados(): Alumno[] {
    if (!this.textoBusqueda.trim()) return this.alumnos;
    const texto = this.textoBusqueda.toLowerCase();
    return this.alumnos.filter(a =>
      a.nombre.toLowerCase().includes(texto) ||
      a.matricula?.toLowerCase().includes(texto)
    );
  }

  // ------ Nombre del grupo en tabla ------
  getNombreGrupo(grupo_id: number): string {
    const grupo = this.grupos.find(g => g.id === grupo_id);
    if (!grupo) return `Grupo ${grupo_id}`;
    const nivel = this.nivelesAcademicos.find(n => n.id === grupo.nivel_academico_id);
    return nivel ? `${nivel.nombre} ${grupo.nombre}` : grupo.nombre;
  }

  // ------ Cargar todos los datos ------
  cargarDatos(): void {
    this.isLoading = true;
    this.studentsService.obtenerAlumnos().subscribe({
      next: (data) => { this.alumnos = data; this.isLoading = false; },
      error: () => { this.sweetAlert.error('Error', 'No se pudieron cargar los alumnos'); this.isLoading = false; }
    });
    this.groupsService.obtenerGrupos().subscribe({
      next: (data) => this.grupos = data
    });
    this.educationLevelsService.obtenerNiveles().subscribe({
      next: (data) => this.nivelesEducativos = data
    });
    this.academicLevelsService.obtenerNiveles().subscribe({
      next: (data) => this.nivelesAcademicos = data
    });
  }

  // ------ Cuando cambia nivel educativo ------
  onNivelEducativoChange(): void {
    this.nivelAcademicoSeleccionado = null;
    this.form.get('grupo_id')!.setValue('');
  }

  // ------ Cuando cambia nivel académico ------
  onNivelAcademicoChange(): void {
    this.form.get('grupo_id')!.setValue('');
  }

  // ------ Abrir modal crear ------
  abrirModalCrear(): void {
    this.modoEdicion = false;
    this.alumnoSeleccionado = null;
    this.nivelEducativoSeleccionado = null;
    this.nivelAcademicoSeleccionado = null;
    this.form.reset();
  }

  // ------ Abrir modal editar ------
  abrirModalEditar(alumno: Alumno): void {
    this.modoEdicion = true;
    this.alumnoSeleccionado = alumno;
    this.form.patchValue({ nombre: alumno.nombre });
  }

  // ------ Guardar ------
  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;

    if (this.modoEdicion && this.alumnoSeleccionado) {
      const data: ActualizarAlumno = { nombre: this.form.value.nombre };
      this.studentsService.actualizarAlumno(this.alumnoSeleccionado.id, data).subscribe({
        next: () => { this.sweetAlert.toast('Alumno actualizado', 'success'); this.cerrarModal(); this.cargarDatos(); this.isSubmitting = false; },
        error: () => { this.sweetAlert.error('Error', 'No se pudo actualizar'); this.isSubmitting = false; }
      });
    } else {
      const data: CrearAlumno = {
        nombre:    this.form.value.nombre,
        matricula: this.form.value.matricula,
        grupo_id:  Number(this.form.value.grupo_id)
      };
      this.studentsService.crearAlumno(data).subscribe({
        next: () => { this.sweetAlert.toast('Alumno creado', 'success'); this.cerrarModal(); this.cargarDatos(); this.isSubmitting = false; },
        error: () => { this.sweetAlert.error('Error', 'No se pudo crear el alumno'); this.isSubmitting = false; }
      });
    }
  }

  // ------ Eliminar ------
  async eliminar(alumno: Alumno): Promise<void> {
    const result = await this.sweetAlert.confirmDelete(`¿Eliminar a ${alumno.nombre}?`);
    if (result.isConfirmed) {
      this.studentsService.eliminarAlumno(alumno.id).subscribe({
        next: () => { this.sweetAlert.toast('Alumno eliminado', 'success'); this.cargarDatos(); },
        error: () => this.sweetAlert.error('Error', 'No se pudo eliminar')
      });
    }
  }

  // ------ Importar Excel ------
  onArchivoExcel(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      // Espera columnas: nombre, matricula, grupo
      this.alumnosExcel = rows.map(r => ({
        nombre:    r['nombre']    || r['Nombre']    || '',
        matricula: r['matricula'] || r['Matricula'] || '',
        grupo:     r['grupo']     || r['Grupo']     || ''
      })).filter(r => r.nombre);
    };

    reader.readAsArrayBuffer(file);
  }

  async importarExcel(): Promise<void> {
    if (!this.alumnosExcel.length) return;

    const result = await this.sweetAlert.confirm(
      `¿Importar ${this.alumnosExcel.length} alumnos?`,
      'Se crearán todos los alumnos del archivo Excel'
    );

    if (!result.isConfirmed) return;

    this.importando = true;
    this.sweetAlert.loading('Importando...', 'Creando alumnos');

    let exitosos = 0;
    let fallidos = 0;

    for (const alumno of this.alumnosExcel) {
      // Busca el grupo por nombre
      const grupo = this.grupos.find(
        g => g.nombre.toLowerCase() === alumno.grupo.toLowerCase()
      );

      if (!grupo) { fallidos++; continue; }

      try {
        await new Promise<void>((resolve, reject) => {
          this.studentsService.crearAlumno({
            nombre:    alumno.nombre,
            matricula: alumno.matricula,
            grupo_id:  grupo.id
          }).subscribe({ next: () => resolve(), error: () => reject() });
        });
        exitosos++;
      } catch { fallidos++; }
    }

    this.sweetAlert.closeLoading();
    this.importando = false;
    this.alumnosExcel = [];

    if (fallidos === 0) {
      this.sweetAlert.success('¡Importación exitosa!', `${exitosos} alumnos creados correctamente`);
    } else {
      this.sweetAlert.warning('Importación parcial', `${exitosos} creados, ${fallidos} fallaron (grupo no encontrado)`);
    }

    this.cargarDatos();
    this.cerrarModalExcel();
  }
  descargarPlantilla(): void {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['nombre', 'matricula', 'grupo'],  // ← encabezados
      ['Juan Pérez', '2024001', 'A'],    // ← fila de ejemplo
      ['María García', '2024002', 'B'],  // ← fila de ejemplo
    ]);

    // Ancho de columnas
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 10 }];

    XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');
    XLSX.writeFile(wb, 'plantilla_alumnos.xlsx');
  }

  // ------ Cerrar modales ------
  cerrarModal(): void {
    this.form.reset();
    this.modoEdicion = false;
    this.alumnoSeleccionado = null;
    this.nivelEducativoSeleccionado = null;
    this.nivelAcademicoSeleccionado = null;
    const modal = document.getElementById('modalAlumno');
    if (modal) (window as any).bootstrap.Modal.getInstance(modal)?.hide();
  }

  cerrarModalExcel(): void {
    this.alumnosExcel = [];
    const modal = document.getElementById('modalExcel');
    if (modal) (window as any).bootstrap.Modal.getInstance(modal)?.hide();
  }
}
