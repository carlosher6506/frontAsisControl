import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENV_ASIS } from '../../../config/environment';
import { ConfiguracionEvaluacion } from '../../../core/models/evaluation.model';
import { Grupo } from '../../../core/models/group.model';
import { GrupoMateria } from '../../../core/models/groupSubject.model';
import { Etiqueta } from '../../../core/models/label.model';
import { Tarea } from '../../../core/models/task.model';
import { AuthService } from '../../../core/services/auth.service';
import { EtiquetasService } from '../../../core/services/etiquetas.service';
import { EvaluationsService } from '../../../core/services/evaluations.service';
import { GrupoMateriasService } from '../../../core/services/grupo-materias.service';
import { GroupsService } from '../../../core/services/groups.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { TasksService } from '../../../core/services/tasks.service';
import { TasksComponent } from './tasks.component';

const grupo: Grupo = {
  id: 1, nombre: 'A', maestro_id: 5, nivel_academico_id: 1, ciclo_escolar_id: 1,
  nivel_educativo: 'Secundaria'
};
const materia: GrupoMateria = {
  id: 10, grupo_id: 1, materia_id: 2, maestro_id: 5, materia_nombre: 'Biología'
};
const evaluacion: ConfiguracionEvaluacion = {
  id: 3, grupo_id: 1, tipo_evaluacion: 'puntos', num_periodos: 3,
  tipo_periodo: 'trimestre', tipo_calculo: 'dividido'
};
const etiqueta: Etiqueta = { id: 7, configuracion_id: 3, nombre: 'Examen', valor_total: 30 };
const tarea = (id: number, overrides: Partial<Tarea> = {}): Tarea => ({
  id, grupo_materia_id: 10, nombre: `Tarea ${id}`, fecha: '2026-10-30',
  periodo: 1, etiqueta_id: 7, valor_propio: 10, ...overrides
});

describe('Creación y listado de tareas', () => {
  let component: TasksComponent;
  let http: HttpTestingController;
  let alerts: { error: ReturnType<typeof vi.fn>; toast: ReturnType<typeof vi.fn>; confirmDelete: ReturnType<typeof vi.fn> };
  const url = `${ENV_ASIS.apiUrl}/tasks`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    alerts = { error: vi.fn(), toast: vi.fn(), confirmDelete: vi.fn().mockResolvedValue({ isConfirmed: true }) };
    component = new TasksComponent(
      TestBed.inject(TasksService),
      { obtenerGrupoMaterias: () => of([materia]) } as unknown as GrupoMateriasService,
      { obtenerGrupos: () => of([grupo]) } as unknown as GroupsService,
      { obtenerEvaluaciones: () => of([evaluacion]) } as unknown as EvaluationsService,
      { obtenerEtiquetas: () => of([etiqueta]) } as unknown as EtiquetasService,
      { getUsuario: () => ({ id: 5, rol: 'maestro' }) } as unknown as AuthService,
      alerts as unknown as SweetAlertService,
      new FormBuilder()
    );
    component.ngOnInit();
    component.seleccionarGrupo(grupo);
  });

  afterEach(() => {
    component.ngOnDestroy();
    http.verify();
  });

  function cargar(tareas: Tarea[] = []): void {
    component.seleccionarMateria(materia);
    http.expectOne(`${url}/grupoMateria/10`).flush(tareas);
  }

  function completarFormulario(valor = 10): void {
    component.form.patchValue({ nombre: 'Nueva tarea', fecha: '2026-10-30', etiqueta_id: '7', valor_propio: valor });
  }

  it('consulta las tareas por materia sin depender del listado global filtrado por permisos', () => {
    http.expectNone(url);
    cargar([tarea(1)]);
    expect(component.tareasFiltradas).toMatchObject([{ id: 1, etiqueta_nombre: 'Examen' }]);
  });

  it('muestra tareas con identificadores de texto y periodo nulo igual que calificar', () => {
    component.seleccionarMateria(materia);
    http.expectOne(`${url}/grupoMateria/10`).flush([
      { ...tarea(1), id: '1', grupo_materia_id: '10', periodo: null, etiqueta_id: '7', valor_propio: '10.5' }
    ]);
    expect(component.tareasFiltradas).toMatchObject([{ id: 1, periodo: 1, valor_propio: 10.5 }]);
    component.form.patchValue({ etiqueta_id: '7' });
    expect(component.getPuntosDisponibles()).toBe(19.5);
  });

  it('cuenta los puntos de tareas ocultas por el buscador y limita el cálculo a materia, periodo y etiqueta', () => {
    cargar([
      tarea(1), tarea(2, { periodo: 2, valor_propio: 30 }),
      tarea(3, { grupo_materia_id: 20, valor_propio: 30 }),
      tarea(4, { etiqueta_id: 8, valor_propio: 30 })
    ]);
    component.textoBusquedaTareas = 'no coincide';
    completarFormulario(30);
    expect(component.tareasFiltradas).toEqual([]);
    expect(component.getPuntosDisponibles()).toBe(20);
    component.guardar();
    http.expectNone(url);
    expect(alerts.error).toHaveBeenCalledWith('Valor inválido', expect.any(String));
  });

  it('excluye del consumo los puntos de la tarea que se está editando', () => {
    cargar([tarea(1, { valor_propio: 20 }), tarea(2)]);
    component.editarTarea(component.tareas[0]);
    expect(component.getPuntosDisponibles()).toBe(20);
  });

  it('muestra la tarea recién creada aunque hubiera una búsqueda activa, sin recargar todos los datos', () => {
    cargar([tarea(1)]);
    component.textoBusquedaTareas = 'oculta';
    completarFormulario();
    component.guardar();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      grupo_materia_id: 10, nombre: 'Nueva tarea', fecha: '2026-10-30',
      periodo: 1, etiqueta_id: 7, valor_propio: 10
    });
    request.flush(tarea(2, { nombre: 'Nueva tarea' }));
    expect(component.tareasFiltradas.map(t => t.nombre)).toEqual(['Tarea 1', 'Nueva tarea']);
    expect(component.textoBusquedaTareas).toBe('');
    expect(component.isSubmitting).toBe(false);
    expect(alerts.toast).toHaveBeenCalledWith('Tarea creada', 'success');
    http.expectNone(url);
  });

  it('actualiza la tarea en la lista sin duplicarla y conserva su etiqueta', () => {
    cargar([tarea(1)]);
    component.editarTarea(component.tareas[0]);
    component.form.patchValue({ nombre: 'Corregida', valor_propio: 20 });
    component.guardar();
    const request = http.expectOne(`${url}/1`);
    expect(request.request.method).toBe('PUT');
    request.flush(tarea(1, { nombre: 'Corregida', valor_propio: 20 }));
    expect(component.tareasFiltradas).toMatchObject([
      { id: 1, nombre: 'Corregida', valor_propio: 20, etiqueta_nombre: 'Examen' }
    ]);
    expect(component.tareasFiltradas).toHaveLength(1);
  });

  it('conserva el formulario y muestra el motivo del rechazo del servidor', () => {
    cargar();
    completarFormulario(30);
    component.guardar();
    http.expectOne(url).flush({ message: 'Solo hay 20 pts disponibles en este periodo' }, { status: 400, statusText: 'Bad Request' });
    expect(alerts.error).toHaveBeenCalledWith('Error', 'Solo hay 20 pts disponibles en este periodo');
    expect(component.form.value.nombre).toBe('Nueva tarea');
    expect(component.isSubmitting).toBe(false);
    expect(alerts.toast).not.toHaveBeenCalled();
  });

  it('impide guardar con puntos desconocidos durante una carga fallida y permite reintentar', () => {
    component.seleccionarMateria(materia);
    completarFormulario();
    component.guardar();
    http.expectNone(url);
    http.expectOne(`${url}/grupoMateria/10`).flush({}, { status: 500, statusText: 'Error' });
    component.guardar();
    http.expectNone(url);
    expect(component.errorCargaTareas).toBe(true);
    expect(component.getPuntosDisponibles()).toBeNull();
    component.cargarTareasMateria();
    http.expectOne(`${url}/grupoMateria/10`).flush([tarea(1)]);
    expect(component.errorCargaTareas).toBe(false);
    expect(component.getPuntosDisponibles()).toBe(20);
  });

  it('cancela la consulta anterior al cambiar de materia para evitar mezclar tareas', () => {
    component.seleccionarMateria(materia);
    const anterior = http.expectOne(`${url}/grupoMateria/10`);
    component.seleccionarMateria({ ...materia, id: 20 });
    expect(anterior.cancelled).toBe(true);
    http.expectOne(`${url}/grupoMateria/20`).flush([tarea(2, { grupo_materia_id: 20 })]);
    expect(component.tareasFiltradas.map(t => t.id)).toEqual([2]);
  });

  it('evita envíos duplicados y cambios de contexto mientras se guarda', () => {
    cargar();
    completarFormulario();
    component.guardar();
    component.guardar();
    component.seleccionarMateria({ ...materia, id: 20 });
    component.seleccionarPeriodo(2);
    component.cerrarModal();
    expect(component.grupoMateriaSeleccionado?.id).toBe(10);
    expect(component.periodoSeleccionado).toBe(1);
    expect(component.modalAbierto).toBe(true);
    http.expectOne(url).flush(tarea(1));
  });

  it('elimina de la lista y libera los puntos sin depender de otra carga global', async () => {
    cargar([tarea(1, { valor_propio: 30 })]);
    component.editarTarea(component.tareas[0]);
    const eliminacion = component.eliminar(component.tareas[0]);
    await eliminacion;
    const request = http.expectOne(`${url}/1`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ message: 'Tarea eliminada' });
    expect(component.tareasFiltradas).toEqual([]);
    expect(component.tareaEditando).toBeNull();
    component.form.patchValue({ etiqueta_id: '7' });
    expect(component.getPuntosDisponibles()).toBe(30);
    expect(component.isSubmitting).toBe(false);
  });
});
