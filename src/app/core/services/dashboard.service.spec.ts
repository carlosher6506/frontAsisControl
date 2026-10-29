import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENV_ASIS } from '../../config/environment';
import { DashboardService } from './dashboard.service';

describe('Totales del panel', () => {
  let service: DashboardService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DashboardService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('usa conteos del servidor superiores a mil sin descargar listas completas', () => {
    const receive = vi.fn();
    service.getStats().subscribe(receive);
    const stats = { totalEstudiantes: 2307, totalGrupos: 50, totalEvaluaciones: 50, totalTareas: 3501, totalUsuarios: 1002 };
    http.expectOne(`${ENV_ASIS.apiUrl}/dashboard/stats`).flush(stats);
    expect(receive).toHaveBeenCalledWith(stats);
    for (const route of ['students', 'tasks', 'groups', 'evaluations', 'users']) {
      http.expectNone(`${ENV_ASIS.apiUrl}/${route}`);
    }
  });

  it('propaga errores para que la pantalla no muestre ceros como si fueran totales reales', () => {
    const error = vi.fn();
    service.getStats().subscribe({ error });
    http.expectOne(`${ENV_ASIS.apiUrl}/dashboard/stats`).flush({}, { status: 500, statusText: 'Error' });
    expect(error).toHaveBeenCalled();
  });
});

