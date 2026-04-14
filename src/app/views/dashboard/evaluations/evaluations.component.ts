import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { EvaluationsService } from '../../../core/services/evaluations.service';
import { EtiquetasService } from '../../../core/services/etiquetas.service';
import { GroupsService } from '../../../core/services/groups.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfiguracionEvaluacion, CrearEvaluacion } from '../../../core/models/evaluation.model';
import { Etiqueta, CrearEtiqueta } from '../../../core/models/label.model';
import { Grupo } from '../../../core/models/group.model';
import { Usuario } from '../../../core/models/user.model';

@Component({
  selector: 'app-evaluations',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './evaluations.component.html',
  styleUrl: './evaluations.component.scss'
})
export class EvaluationsComponent implements OnInit {

  evaluaciones: ConfiguracionEvaluacion[] = [];
  etiquetas: Etiqueta[] = [];
  grupos: Grupo[] = [];
  usuario: Usuario | null = null;

  isLoadingEvaluaciones = true;
  evaluacionActiva: ConfiguracionEvaluacion | null = null;
  etiquetaEditando: Etiqueta | null = null;

  formEvaluacion: FormGroup;
  formEtiqueta: FormGroup;

  tiposEvaluacion = [
    { value: 'puntos',   label: 'Por puntos' },
    { value: 'promedio', label: 'Por promedio' }
  ];

  tiposPeriodo = [
    { value: 'parcial',   label: 'Parciales' },
    { value: 'trimestre', label: 'Trimestres' }
  ];

  tiposCalculo = [
    { value: 'neto',     label: 'Neto (cada etiqueta vale X por periodo)' },
    { value: 'dividido', label: 'Dividido (valor total ÷ periodos)' }
  ];

  constructor(
    private evaluationsService: EvaluationsService,
    private etiquetasService: EtiquetasService,
    private groupsService: GroupsService,
    private authService: AuthService,
    private sweetAlert: SweetAlertService,
    private fb: FormBuilder
  ) {
    this.usuario = this.authService.getUsuario();

    this.formEvaluacion = this.fb.group({
      grupo_id:        ['', Validators.required],
      tipo_evaluacion: ['', Validators.required],
      num_periodos:    [3, [Validators.required, Validators.min(1), Validators.max(9)]],
      tipo_periodo:    ['parcial', Validators.required],
      tipo_calculo:    ['neto', Validators.required]
    });

    this.formEtiqueta = this.fb.group({
      nombre:      ['', Validators.required],
      valor_total: ['', [Validators.required, Validators.min(0)]]
    });

    this.formEvaluacion.get('tipo_evaluacion')!.valueChanges.subscribe(val => {
      const tipoCalculo = this.formEvaluacion.get('tipo_calculo')!;
      if (val === 'promedio') {
        tipoCalculo.clearValidators();
        tipoCalculo.setValue('neto');
      } else {
        tipoCalculo.setValidators(Validators.required);
      }
      tipoCalculo.updateValueAndValidity();
    });
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  get esAdmin(): boolean {
    return this.usuario?.rol?.toLowerCase() === 'admin';
  }

  get esPorPuntos(): boolean {
    return this.evaluacionActiva?.tipo_evaluacion === 'puntos';
  }

  get gruposDisponibles(): Grupo[] {
    const gruposConConfig = this.evaluaciones.map(e => e.grupo_id);
    if (this.esAdmin) return this.grupos.filter(g => !gruposConConfig.includes(g.id));
    return this.grupos.filter(g => g.maestro_id === this.usuario?.id && !gruposConConfig.includes(g.id));
  }

  get etiquetasFiltradas(): Etiqueta[] {
    if (!this.evaluacionActiva) return [];
    return this.etiquetas.filter(e => e.configuracion_id === this.evaluacionActiva!.id);
  }

  cargarDatos(): void {
    this.isLoadingEvaluaciones = true;

    this.groupsService.obtenerGrupos().subscribe({
      next: (data) => {
        this.grupos = this.esAdmin ? data : data.filter(g => g.maestro_id === this.usuario?.id);
      }
    });

    this.evaluationsService.obtenerEvaluaciones().subscribe({
      next: (data) => {
        this.evaluaciones = this.esAdmin
          ? data
          : data.filter(e => {
              const grupo = this.grupos.find(g => g.id === e.grupo_id);
              return grupo?.maestro_id === this.usuario?.id;
            });
        this.isLoadingEvaluaciones = false;
      },
      error: () => { this.sweetAlert.error('Error', 'No se pudieron cargar'); this.isLoadingEvaluaciones = false; }
    });

    this.etiquetasService.obtenerEtiquetas().subscribe({
      next: (data) => this.etiquetas = data
    });
  }

  seleccionarEvaluacion(evaluacion: ConfiguracionEvaluacion): void {
    if (this.evaluacionActiva?.id === evaluacion.id) {
      this.evaluacionActiva = null;
      return;
    }
    this.evaluacionActiva = evaluacion;
    this.etiquetaEditando = null;
    this.formEtiqueta.reset();
  }

  getNombreGrupo(evaluacion: ConfiguracionEvaluacion): string {
    return `${evaluacion.nivel_educativo || ''} ${evaluacion.nivel_academico || ''} ${evaluacion.grupo_nombre || ''}`.trim();
  }

  // ── CRUD Evaluación ────────────────────────────────────────────
  crearEvaluacion(): void {
    if (this.formEvaluacion.invalid) { this.formEvaluacion.markAllAsTouched(); return; }

    const data: CrearEvaluacion = {
      grupo_id:        Number(this.formEvaluacion.value.grupo_id),
      tipo_evaluacion: this.formEvaluacion.value.tipo_evaluacion,
      num_periodos:    Number(this.formEvaluacion.value.num_periodos),
      tipo_periodo:    this.formEvaluacion.value.tipo_periodo,
      tipo_calculo:    this.formEvaluacion.value.tipo_calculo
    };

    this.evaluationsService.crearEvaluacion(data).subscribe({
      next: () => {
        this.sweetAlert.toast('Configuración creada', 'success');
        this.formEvaluacion.reset({ num_periodos: 3, tipo_periodo: 'parcial', tipo_calculo: 'neto' });
        this.cerrarModal('modalEvaluacion');
        this.cargarDatos();
      },
      error: (err) => this.sweetAlert.error('Error', err.error?.message || 'No se pudo crear')
    });
  }

  async eliminarEvaluacion(evaluacion: ConfiguracionEvaluacion): Promise<void> {
    const result = await this.sweetAlert.confirmDelete(
      `¿Eliminar configuración de ${this.getNombreGrupo(evaluacion)}?`,
      'Se eliminarán también las etiquetas asociadas'
    );
    if (result.isConfirmed) {
      this.evaluationsService.eliminarEvaluacion(evaluacion.id).subscribe({
        next: () => {
          this.sweetAlert.toast('Configuración eliminada', 'success');
          if (this.evaluacionActiva?.id === evaluacion.id) this.evaluacionActiva = null;
          this.cargarDatos();
        },
        error: () => this.sweetAlert.error('Error', 'No se pudo eliminar')
      });
    }
  }

  // ── CRUD Etiqueta ──────────────────────────────────────────────
  guardarEtiqueta(): void {
    if (this.formEtiqueta.invalid) { this.formEtiqueta.markAllAsTouched(); return; }

    if (this.etiquetaEditando) {
      this.etiquetasService.actualizarEtiqueta(this.etiquetaEditando.id, this.formEtiqueta.value).subscribe({
        next: () => {
          this.sweetAlert.toast('Etiqueta actualizada', 'success');
          this.etiquetaEditando = null;
          this.formEtiqueta.reset();
          this.cargarDatos();
        },
        error: () => this.sweetAlert.error('Error', 'No se pudo actualizar')
      });
    } else {
      if (!this.evaluacionActiva) return;
      const data: CrearEtiqueta = {
        configuracion_id: this.evaluacionActiva.id,
        nombre:           this.formEtiqueta.value.nombre,
        valor_total:      Number(this.formEtiqueta.value.valor_total)
      };
      this.etiquetasService.crearEtiqueta(data).subscribe({
        next: () => {
          this.sweetAlert.toast('Etiqueta creada', 'success');
          this.formEtiqueta.reset();
          this.cargarDatos();
        },
        error: () => this.sweetAlert.error('Error', 'No se pudo crear')
      });
    }
  }

  editarEtiqueta(etiqueta: Etiqueta): void {
    this.etiquetaEditando = etiqueta;
    this.formEtiqueta.patchValue({ nombre: etiqueta.nombre, valor_total: etiqueta.valor_total });
  }

  cancelarEdicionEtiqueta(): void {
    this.etiquetaEditando = null;
    this.formEtiqueta.reset();
  }

  async eliminarEtiqueta(etiqueta: Etiqueta): Promise<void> {
    const result = await this.sweetAlert.confirmDelete(`¿Eliminar etiqueta "${etiqueta.nombre}"?`);
    if (result.isConfirmed) {
      this.etiquetasService.eliminarEtiqueta(etiqueta.id).subscribe({
        next: () => {
          this.sweetAlert.toast('Etiqueta eliminada', 'success');
          if (this.etiquetaEditando?.id === etiqueta.id) this.etiquetaEditando = null;
          this.cargarDatos();
        },
        error: () => this.sweetAlert.error('Error', 'No se pudo eliminar')
      });
    }
  }

  cerrarModal(id: string): void {
    const modal = document.getElementById(id);
    if (modal) (window as any).bootstrap.Modal.getInstance(modal)?.hide();
  }
}
