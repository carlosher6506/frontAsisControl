import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ConfiguracionEvaluacion } from '../../../core/models/evaluation.model';
import { AuthService } from '../../../core/services/auth.service';
import { EtiquetasService } from '../../../core/services/etiquetas.service';
import { EvaluationsService } from '../../../core/services/evaluations.service';
import { GrupoMateriasService } from '../../../core/services/grupo-materias.service';
import { GroupsService } from '../../../core/services/groups.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { UsersService } from '../../../core/services/users.service';
import { EvaluationsComponent } from './evaluations.component';

function crearComponente(rol: string, errorUsuarios = false) {
  const usuarios = [{ id: 5, nombre: 'Ana', email: 'ana@example.com', rol: 'maestro' }];
  const users = {
    obtenerUsuarios: vi.fn(() => errorUsuarios
      ? throwError(() => ({ status: 403 }))
      : of(usuarios))
  };
  const etiquetas = {
    obtenerEtiquetas: vi.fn(() => of([])),
    crearEtiqueta: vi.fn(() => of({ id: 1, configuracion_id: 3, nombre: 'Examen', valor_total: 30 }))
  };
  const alerts = { error: vi.fn(), toast: vi.fn() };
  const componente = new EvaluationsComponent(
    { obtenerEvaluaciones: () => of([]) } as unknown as EvaluationsService,
    etiquetas as unknown as EtiquetasService,
    { obtenerGrupos: () => of([]) } as unknown as GroupsService,
    { obtenerGrupoMaterias: () => of([]) } as unknown as GrupoMateriasService,
    users as unknown as UsersService,
    { getUsuario: () => ({ id: 5, rol }) } as unknown as AuthService,
    alerts as unknown as SweetAlertService,
    new FormBuilder()
  );
  return { componente, users, etiquetas, alerts, usuarios };
}

describe('Permisos al cargar evaluaciones', () => {
  it('permite al maestro cargar evaluaciones y crear etiquetas sin consultar usuarios', () => {
    const { componente, users, etiquetas, alerts } = crearComponente('maestro');
    componente.ngOnInit();
    componente.evaluacionActiva = { id: 3 } as ConfiguracionEvaluacion;
    componente.formEtiqueta.patchValue({ nombre: 'Examen', valor_total: 30 });
    componente.guardarEtiqueta();
    expect(etiquetas.crearEtiqueta).toHaveBeenCalledWith({
      configuracion_id: 3, nombre: 'Examen', valor_total: 30
    });
    expect(etiquetas.obtenerEtiquetas).toHaveBeenCalledTimes(2);
    expect(users.obtenerUsuarios).not.toHaveBeenCalled();
    expect(alerts.toast).toHaveBeenCalledWith('Etiqueta creada', 'success');
    expect(alerts.error).not.toHaveBeenCalled();
    expect(componente.isLoadingEvaluaciones).toBe(false);
  });

  it('conserva el catálogo de maestros para el filtro del administrador', () => {
    const { componente, users, usuarios } = crearComponente('admin');
    componente.ngOnInit();
    expect(users.obtenerUsuarios).toHaveBeenCalledTimes(1);
    expect(componente.maestrosDisponibles).toEqual(usuarios);
  });

  it('maneja un fallo del catálogo de usuarios sin dejar una excepción sin capturar', () => {
    const { componente, alerts } = crearComponente('admin', true);
    componente.ngOnInit();
    expect(alerts.error).toHaveBeenCalledWith('Error', 'No se pudo cargar la lista de maestros');
    expect(componente.isLoadingEvaluaciones).toBe(false);
  });
});
