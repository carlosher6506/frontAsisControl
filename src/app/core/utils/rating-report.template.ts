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

/**
 * Builds the "boleta" markup as a standalone fragment: a <style> tag plus a
 * `.sheet` element, meant to be injected into an off-screen container and
 * rasterized with html2canvas for PDF export (see ratings.component.ts ->
 * generarPdfBoleta). It intentionally has no <html>/<body> wrapper and no
 * window.print() script — it is not opened in a separate window anymore.
 */
export function buildRatingReportFragment(
  report: Boleta,
  getFinalGrade: (item: BoletaMateria) => number,
): string {
  const subjects = [...new Set(report.calificaciones.map((item) => item.materia_nombre))];
  const subjectSections = subjects
    .map((subject) => {
      const items = report.calificaciones.filter((item) => item.materia_nombre === subject);
      const grades = items.map(getFinalGrade);
      const finalAverage = grades.length
        ? Math.round(grades.reduce((total, grade) => total + grade, 0) / grades.length)
        : 0;
      const minimumGrade = items[0]?.calificacion_minima_aprobatoria || 6;
      const rows = items
        .map((item) => {
          const grade = getFinalGrade(item);
          const periodName = item.tipo_periodo === 'trimestre' ? 'Trimestre' : 'Parcial';
          const status = grade >= item.calificacion_minima_aprobatoria ? 'Aprobado' : 'Reprobado';
          return `<tr><td>${periodName} ${item.periodo}</td><td class="grade">${grade}</td><td>${status}</td></tr>`;
        })
        .join('');

      return `<section class="subject">
      <h2>${escapeHtml(subject)}</h2>
      <table>
        <thead><tr><th>Periodo</th><th>Calificación</th><th>Estado</th></tr></thead>
        <tbody>
          ${rows}
          <tr class="final"><td>Promedio final</td><td class="grade">${finalAverage}</td><td>${finalAverage >= minimumGrade ? 'Aprobado' : 'Reprobado'}</td></tr>
        </tbody>
      </table>
    </section>`;
    })
    .join('');

  const { alumno } = report;
  const gradeAndGroup =
    `${alumno.nivel_academico || ''} ${alumno.grupo_nombre || ''}`.trim() || '—';

  return `
    <style>
      * { box-sizing: border-box; }
      .sheet { background: #fff; color: #17202a; font-family: Arial, sans-serif; padding: 25px 35px; width: 800px; }
      .masthead { border-bottom: 4px solid #202932; display: flex; gap: 20px; justify-content: space-between; padding-bottom: 18px; }
      .brand { color: #59646e; font-size: 12px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; }
      .title { font-size: 25px; font-weight: 800; margin: 7px 0; }
      .cycle { color: #64707a; font-size: 13px; }
      .seal { border: 2px solid #202932; border-radius: 50%; display: grid; font-size: 10px; font-weight: 800; height: 65px; place-items: center; text-align: center; width: 65px; }
      .student { display: grid; gap: 10px 36px; grid-template-columns: 1fr 1fr; margin: 26px 0; }
      .field label { color: #6a737c; display: block; font-size: 10px; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; }
      .field strong { border-bottom: 1px solid #d9dde1; display: block; font-size: 14px; padding: 5px 0; }
      .subject { break-inside: avoid; margin-top: 22px; }
      .subject h2 { background: #202932; border-radius: 5px 5px 0 0; color: #fff; font-size: 14px; margin: 0; padding: 9px 12px; }
      table { border-collapse: collapse; font-size: 12px; width: 100%; }
      th { background: #f1f3f5; color: #4b5560; font-size: 10px; letter-spacing: .7px; text-align: left; text-transform: uppercase; }
      th, td { border: 1px solid #dfe3e6; padding: 8px 10px; }
      .grade { font-weight: 800; text-align: center; }
      .final td { background: #eef0f2; font-weight: 800; }
      .footer { border-top: 1px solid #dfe3e6; color: #6b7280; font-size: 10px; margin-top: 35px; padding-top: 14px; text-align: center; }
    </style>
    <div class="sheet">
      <header class="masthead">
        <div><div class="brand">Control académico</div><h1 class="title">Boleta de calificaciones</h1><div class="cycle">Ciclo escolar ${escapeHtml(alumno.ciclo_escolar || '—')}</div></div>
        <div class="seal">CONTROL<br>ACADÉMICO</div>
      </header>
      <section class="student">
        <div class="field"><label>Alumno(a)</label><strong>${escapeHtml(alumno.nombre)}</strong></div>
        <div class="field"><label>Matrícula</label><strong>${escapeHtml(alumno.matricula || '—')}</strong></div>
        <div class="field"><label>Nivel educativo</label><strong>${escapeHtml(alumno.nivel_educativo || '—')}</strong></div>
        <div class="field"><label>Grado y grupo</label><strong>${escapeHtml(gradeAndGroup)}</strong></div>
      </section>
      ${subjectSections}
      <footer class="footer">Documento generado por Control Académico · ${new Date().toLocaleDateString('es-MX')}</footer>
    </div>`;
}
