import { describe, expect, it } from 'vitest';
import { Boleta, BoletaMateria } from '../models/rating.model';
import { buildRatingReportPages } from './rating-report.template';

const ejemploBoleta: Boleta = {
  alumno: {
    id: 1,
    nombre: 'Ana Pérez',
    matricula: '001',
    grupo_nombre: 'A',
    nivel_academico: '3°',
    nivel_educativo: 'Primaria',
    ciclo_escolar: '2026-2027',
  },
  calificaciones: ['Español', 'Matemáticas'].flatMap((nombre) =>
    [1, 2, 3].map((periodo): BoletaMateria => ({
      materia_nombre: nombre,
      periodo,
      tipo_evaluacion: 'promedio',
      tipo_calculo: 'neto',
      num_periodos: 3,
      tipo_periodo: 'trimestre',
      calificacion_minima_aprobatoria: 6,
      forzar_minimo: false,
      promedio_calificaciones: 8 + (periodo === 3 ? 1 : 0),
      total_puntos_obtenidos: null,
      total_puntos_posibles: null,
    })),
  ),
};
const nota = (item: BoletaMateria) => Math.round(item.promedio_calificaciones || 0);

describe('Diseño de boletas', () => {
  it('usa materias en columnas y periodos en filas, sin estados', () => {
    const pages = buildRatingReportPages(ejemploBoleta, nota);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toContain('Español');
    expect(pages[0]).toContain('Trimestre 3');
    expect(pages[0]).not.toContain('Observaciones');
    expect(pages[0]).not.toContain('Control Académico');
    expect(pages[0]).toContain('AsisControlGo');
    expect(pages[0]).toContain('images/Logo_5.png');
    expect(pages[0]).not.toMatch(/Estado|Aprobado|Reprobado/);
    expect(pages[0]).not.toMatch(/CURP|Turno/);
  });
  it('mantiene las notas y promedios actuales', () => {
    const page = buildRatingReportPages(ejemploBoleta, nota)[0];
    expect(page).toContain('class="grade">9</td>');
    expect(page).toContain('class="overall-grade">8</p>');
  });
  it('escapa nombres y conserva el grupo seleccionado de un alumno multigrupo', () => {
    const report = {
      ...ejemploBoleta,
      alumno: { ...ejemploBoleta.alumno, nombre: '<img src=x>', grupo_nombre: 'Otro' },
    };
    const page = buildRatingReportPages(report, nota, {
      grupoNombre: 'B',
      nivelAcademico: '5°',
    })[0];
    expect(page).toContain('&lt;img src=x&gt;');
    expect(page).toContain('5° B');
    expect(page).not.toContain('Otro');
  });
  it('pagina las materias sin omitir ninguna ni cortar tablas', () => {
    const report = {
      ...ejemploBoleta,
      calificaciones: Array.from({ length: 13 }, (_, i) => ({
        ...ejemploBoleta.calificaciones[0],
        materia_nombre: 'Materia ' + i,
      })),
    };
    const pages = buildRatingReportPages(report, nota);
    expect(pages).toHaveLength(3);
    for (let i = 0; i < 13; i++) expect(pages.join('')).toContain('Materia ' + i + '</th>');
    expect(pages[2]).toContain('Hoja 3 de 3');
  });
  it('continúa en otra hoja si hay más de ocho periodos', () => {
    const report = {
      ...ejemploBoleta,
      calificaciones: [{ ...ejemploBoleta.calificaciones[0], num_periodos: 10 }],
    };
    const pages = buildRatingReportPages(report, nota);
    expect(pages).toHaveLength(2);
    expect(pages[1]).toContain('Trimestre 10');
  });
  it('permite una boleta sin calificaciones sin inventar promedios', () => {
    const pages = buildRatingReportPages({ ...ejemploBoleta, calificaciones: [] }, nota);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toContain('Sin calificaciones');
    expect(pages[0]).toContain('class="overall-grade">—</p>');
  });
  it('conserva cero como nota real', () => {
    const page = buildRatingReportPages(
      {
        ...ejemploBoleta,
        calificaciones: [{ ...ejemploBoleta.calificaciones[0], promedio_calificaciones: 0 }],
      },
      nota,
    )[0];
    expect(page).toContain('class="overall-grade">0</p>');
  });
});
