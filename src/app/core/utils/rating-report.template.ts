import { Boleta, BoletaMateria } from '../models/rating.model';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character] ?? character,
  );
}

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

export interface RatingReportContext {
  grupoNombre?: string;
  nivelAcademico?: string;
  nivelEducativo?: string;
  cicloEscolar?: string;
  tipoPeriodo?: 'parcial' | 'trimestre';
  numeroPeriodos?: number;
  logoSrc?: string;
}

const REPORT_STYLES = `
<style>
  .rating-sheet, .rating-sheet * { box-sizing: border-box; }
  .rating-sheet { display: flex; flex-direction: column; width: 1120px; min-height: 760px; padding: 32px; background: white; color: #252525; font: 13px Arial, sans-serif; }
  .rating-sheet .report-heading { display: grid; grid-template-columns: 104px 1fr 104px; align-items: center; gap: 20px; margin-bottom: 18px; }
  .rating-sheet .report-logo { width: 104px; height: 104px; object-fit: contain; }
  .rating-sheet h1 { margin: 0; text-align: center; font-size: 20px; font-weight: 400; }
  .rating-sheet .report-details { display: grid; grid-template-columns: 2fr 1fr; gap: 15px 28px; margin-bottom: 25px; }
  .rating-sheet .report-field { min-height: 36px; padding-bottom: 5px; }
  .rating-sheet .report-field span { display: block; font-size: 12px; margin-bottom: 5px; color: #515151; }
  .rating-sheet .report-field strong { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
  .rating-sheet .report-body { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 1fr); gap: 25px; align-items: start; }
  .rating-sheet table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
  .rating-sheet th, .rating-sheet td { border: 1px solid #595959; padding: 9px 6px; text-align: center; }
  .rating-sheet th { background: #c9bd98; font-size: 12px; font-weight: 400; line-height: 1.35; overflow-wrap: anywhere; }
  .rating-sheet .section-heading { padding: 6px; }
  .rating-sheet .period-heading { width: 100px; }
  .rating-sheet .period-name { font-size: 11px; font-weight: 500; }
  .rating-sheet .subject-name { height: 70px; }
  .rating-sheet .grade { height: 40px; font-weight: 600; font-size: 15px; }
  .rating-sheet .final-row td { background: #f5f2e8; height: 44px; }
  .rating-sheet .summary-box { margin-bottom: 24px; border: 1px solid #595959; text-align: center; }
  .rating-sheet .summary-box h2 { margin: 0; padding: 10px 8px; background: #c9bd98; font-size: 12px; font-weight: 400; }
  .rating-sheet .summary-box p { margin: 0; padding: 16px 8px; font-size: 13px; overflow-wrap: anywhere; }
  .rating-sheet .summary-box .overall-grade { font-size: 25px; font-weight: 600; padding: 18px 8px; }
  .rating-sheet .report-footer { margin-top: auto; padding-top: 22px; font-size: 12px; color: #555; display: flex; justify-content: space-between; }
</style>`;

/** Una hoja por alumno; materias y periodos adicionales continúan en hojas completas, sin cortar tablas. */
export function buildRatingReportPages(
  report: Boleta,
  getFinalGrade: (item: BoletaMateria) => number,
  context: RatingReportContext = {},
): string[] {
  const { alumno, calificaciones } = report;
  const subjects = [...new Set(calificaciones.map((item) => item.materia_nombre))];
  const count = Math.max(
    1,
    context.numeroPeriodos || 1,
    ...calificaciones.map((item) =>
      Math.max(Number(item.num_periodos) || 1, Number(item.periodo) || 1),
    ),
  );
  const periods = Array.from({ length: count }, (_, i) => i + 1);
  const periodName =
    (context.tipoPeriodo ?? calificaciones[0]?.tipo_periodo) === 'trimestre'
      ? 'Trimestre'
      : 'Parcial';
  const subjectBatches = subjects.length ? chunks(subjects, 6) : [[]];
  const periodBatches = chunks(periods, 8);
  const subjectAverage = (subject: string): number | null => {
    const items = calificaciones.filter((item) => item.materia_nombre === subject);
    return items.length
      ? Math.round(items.reduce((sum, item) => sum + getFinalGrade(item), 0) / items.length)
      : null;
  };
  const averages = subjects.map(subjectAverage).filter((value): value is number => value !== null);
  const overall = averages.length
    ? Math.round(averages.reduce((sum, value) => sum + value, 0) / averages.length)
    : null;
  const group =
    [context.nivelAcademico ?? alumno.nivel_academico, context.grupoNombre ?? alumno.grupo_nombre]
      .filter(Boolean)
      .join(' ') || '—';
  const pages: string[] = [];
  const pageCount = subjectBatches.length * periodBatches.length;
  for (const batch of subjectBatches) {
    for (const periodBatch of periodBatches) {
      const rows = periodBatch
        .map(
          (period) =>
            `<tr><td class="period-name">${periodName} ${period}</td>${batch
              .map((subject) => {
                const item = calificaciones.find(
                  (cal) => cal.materia_nombre === subject && Number(cal.periodo) === period,
                );
                return `<td class="grade">${item ? getFinalGrade(item) : '—'}</td>`;
              })
              .join('')}${batch.length ? '' : '<td class="grade">—</td>'}</tr>`,
        )
        .join('');
      pages.push(`${REPORT_STYLES}<div class="sheet rating-sheet">
        <header class="report-heading"><img class="report-logo" src="${escapeHtml(context.logoSrc ?? 'images/Logo_5.png')}" alt="AsisControlGo"><h1>Boleta de calificaciones</h1></header>
        <div class="report-details">
          <div class="report-field"><span>Nombre y apellidos del alumno(a)</span><strong>${escapeHtml(alumno.nombre)}</strong></div>
          <div class="report-field"><span>Matrícula</span><strong>${escapeHtml(alumno.matricula || '—')}</strong></div>
          <div class="report-field"><span>Nivel educativo</span><strong>${escapeHtml(context.nivelEducativo ?? alumno.nivel_educativo ?? '—')}</strong></div>
          <div class="report-field"><span>Grado y grupo</span><strong>${escapeHtml(group)}</strong></div>
        </div>
        <div class="report-body">
          <table>
            <colgroup><col style="width:100px">${Array.from({ length: Math.max(1, batch.length) }, () => '<col>').join('')}</colgroup>
            <thead><tr><th rowspan="2" class="period-heading">Periodo de evaluación</th><th colspan="${Math.max(1, batch.length)}" class="section-heading">Asignaturas</th></tr>
            <tr>${batch.map((subject) => `<th class="subject-name">${escapeHtml(subject)}</th>`).join('') || '<th class="subject-name">Sin calificaciones</th>'}</tr></thead>
            <tbody>${rows}<tr class="final-row"><td class="period-name">Promedio final</td>${batch.map((subject) => `<td class="grade">${subjectAverage(subject) ?? '—'}</td>`).join('') || '<td>—</td>'}</tr></tbody>
          </table>
          <aside>
            <div class="summary-box"><h2>Ciclo escolar</h2><p>${escapeHtml(context.cicloEscolar ?? alumno.ciclo_escolar ?? '—')}</p></div>
            <div class="summary-box"><h2>Promedio final de grado</h2><p class="overall-grade">${overall ?? '—'}</p></div>
          </aside>
        </div>
        <footer class="report-footer"><span>AsisControlGo</span><span>Hoja ${pages.length + 1} de ${pageCount}</span></footer>
      </div>`);
    }
  }
  return pages;
}
