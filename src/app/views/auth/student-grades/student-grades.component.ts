import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { RegisterService } from '../../../core/services/register.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';

@Component({
  selector: 'app-student-grades',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './student-grades.component.html',
  styleUrl: './student-grades.component.scss'
})
export class StudentGradesComponent {

  matricula = '';
  isLoading = false;
  resultado: any = null;
  mostrarBoleta = false;

  constructor(
    private registerService: RegisterService,
    private sweetAlert: SweetAlertService
  ) {}

  buscar(): void {
    if (!this.matricula.trim()) {
      this.sweetAlert.warning('Campo requerido', 'Ingresa tu matrícula');
      return;
    }

    this.isLoading = true;
    this.resultado = null;

    this.registerService.consultarCalificaciones(this.matricula.trim()).subscribe({
      next: (data) => { this.resultado = data; this.isLoading = false; },
      error: (err) => {
        this.sweetAlert.error('No encontrado', err.error?.message || 'Matrícula no encontrada');
        this.isLoading = false;
      }
    });
  }

  calcularCalificacionFinal(item: any): number {
    let cal: number;
    if (item.tipo_evaluacion === 'promedio') {
      cal = Number(item.promedio_calificaciones) || 0;
    } else {
      const obtenidos = Number(item.total_puntos_obtenidos) || 0;
      const posibles  = Number(item.total_puntos_posibles)  || 0;
      if (posibles === 0) return 0;
      cal = (obtenidos / posibles) * 10;
    }
    const redondeado = Math.round(cal * 10) / 10;
    if (redondeado > 0 && redondeado < 6) return 5;
    return Math.round(redondeado);
  }

  getBadge(cal: number, minimo: number): string {
    return cal >= minimo ? 'bg-success' : 'bg-danger';
  }

  get materiasUnicas(): string[] {
    if (!this.resultado) return [];
    return [...new Set(this.resultado.calificaciones.map((c: any) => c.materia_nombre))] as string[];
  }

  getCalificacionesPorMateria(materia: string): any[] {
    if (!this.resultado) return [];
    return this.resultado.calificaciones.filter((c: any) => c.materia_nombre === materia);
  }

  imprimirBoleta(): void {
    const contenido = document.getElementById('boleta-alumno')?.innerHTML;
    if (!contenido) return;
    const ventana = window.open('', '_blank', 'width=800,height=600');
    if (!ventana) return;
    ventana.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>Boleta — ${this.resultado?.alumno?.nombre}</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
      <style>body{padding:20px;} .no-print{display:none!important;}</style>
      </head><body>${contenido}
      <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
      </body></html>
    `);
    ventana.document.close();
  }
}
