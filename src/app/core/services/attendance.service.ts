import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ENV_ASIS } from '../../config/environment';
import { MateriaGrupo, AbrirSesionRequest, ListaAsistenciaResponse, RegistrarAsistenciaManual, RegistrarAsistenciaQr,
  ResultadoRegistroQr, SesionAsistencia, ReporteAsistenciaAlumno, CredencialQr
} from '../models/attendance.model';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private apiUrl = `${ENV_ASIS.apiUrl}/attendance`;
  constructor(private http: HttpClient) {}

  obtenerMateriasDelGrupo(grupoId: number): Observable<MateriaGrupo[]> {
    const params = new HttpParams().set('grupo_id', grupoId);
    return this.http.get<MateriaGrupo[]>(`${this.apiUrl}/subjects`, { params });
  }

  abrirSesion(data: AbrirSesionRequest): Observable<{ sesion_id: number }> {
    return this.http.post<{ sesion_id: number }>(`${this.apiUrl}/session`, data);
  }

  obtenerListaSesion(sesionId: number): Observable<ListaAsistenciaResponse> {
    return this.http.get<ListaAsistenciaResponse>(`${this.apiUrl}/session/${sesionId}/list`);
  }

  registrarManual(data: RegistrarAsistenciaManual): Observable<{ registro_id: number; estado: string }> {
    return this.http.patch<{ registro_id: number; estado: string }>(`${this.apiUrl}/register`, data);
  }

  registrarQr(data: RegistrarAsistenciaQr): Observable<ResultadoRegistroQr> {
    return this.http.post<ResultadoRegistroQr>(`${this.apiUrl}/register-qr`, data);
  }

  cerrarSesion(sesionId: number): Observable<SesionAsistencia> {
    return this.http.patch<SesionAsistencia>(`${this.apiUrl}/session/${sesionId}/close`, {});
  }

  obtenerReporte(grupoMateriaId: number, fechaInicio: string, fechaFin: string): Observable<ReporteAsistenciaAlumno[]> {
    const params = new HttpParams()
      .set('grupo_materia_id', grupoMateriaId)
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);
    return this.http.get<ReporteAsistenciaAlumno[]>(`${this.apiUrl}/report`, { params });
  }

  obtenerQrAlumno(alumnoId: number): Observable<CredencialQr> {
    return this.http.get<CredencialQr>(`${this.apiUrl}/qr/${alumnoId}`);
  }

  regenerarQrAlumno(alumnoId: number): Observable<CredencialQr> {
    return this.http.patch<CredencialQr>(`${this.apiUrl}/qr/${alumnoId}/regenerate`, {});
  }
}
