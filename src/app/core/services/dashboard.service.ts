import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardStats } from '../models/dashboard.model';
import { ENV_ASIS } from '../../config/environment';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  private apiUrl = ENV_ASIS.apiUrl;

  constructor(private http: HttpClient) {}

  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.apiUrl}/dashboard/stats`);
  }

  getUsuariosActividad(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/usuarios-actividad`, {
    });
  }

  getActividadSemanal(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/actividad-semanal`, {
    });
  }

}
