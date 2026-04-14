import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Etiqueta, CrearEtiqueta } from '../models/label.model';
import { ENV_ASIS } from '../../config/environment';

@Injectable({ providedIn: 'root' })
export class EtiquetasService {
  private apiUrl = `${ENV_ASIS.apiUrl}/etiquetas`;
  constructor(private http: HttpClient) {}

  obtenerEtiquetas(): Observable<Etiqueta[]> {
    return this.http.get<Etiqueta[]>(this.apiUrl);
  }
  obtenerEtiquetasPorConfiguracion(configuracion_id: number): Observable<Etiqueta[]> {
    return this.http.get<Etiqueta[]>(`${this.apiUrl}/configuracion/${configuracion_id}`);
  }
  crearEtiqueta(data: CrearEtiqueta): Observable<Etiqueta> {
    return this.http.post<Etiqueta>(this.apiUrl, data);
  }
  actualizarEtiqueta(id: number, data: Partial<CrearEtiqueta>): Observable<Etiqueta> {
    return this.http.put<Etiqueta>(`${this.apiUrl}/${id}`, data);
  }
  eliminarEtiqueta(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
