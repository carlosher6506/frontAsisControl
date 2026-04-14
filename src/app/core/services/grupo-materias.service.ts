import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GrupoMateria, CrearGrupoMateria } from '../models/groupSubject.model';
import { ENV_ASIS } from '../../config/environment';

@Injectable({ providedIn: 'root' })
export class GrupoMateriasService {
  private apiUrl = `${ENV_ASIS.apiUrl}/groupSubjects`;
  constructor(private http: HttpClient) {}

  obtenerGrupoMaterias(): Observable<GrupoMateria[]> {
    return this.http.get<GrupoMateria[]>(this.apiUrl);
  }
  obtenerMateriasPorGrupo(grupo_id: number): Observable<GrupoMateria[]> {
    return this.http.get<GrupoMateria[]>(`${this.apiUrl}/group/${grupo_id}`);
  }
  asignarMateria(data: CrearGrupoMateria): Observable<GrupoMateria> {
    return this.http.post<GrupoMateria>(this.apiUrl, data);
  }
  eliminarGrupoMateria(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
