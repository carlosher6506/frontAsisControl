import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Usuario, CrearUsuario, ActualizarUsuario } from '../models/user.model';
import { ENV_ASIS } from '../../config/environment';

@Injectable({
  providedIn: 'root'
})
export class UsersService {

  private apiUrl = `${ENV_ASIS.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  obtenerUsuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.apiUrl);
  }

  obtenerUsuarioPorId(id: number): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/${id}`);
  }

  crearUsuario(data: CrearUsuario): Observable<Usuario> {
    return this.http.post<Usuario>(this.apiUrl, data);
  }

  actualizarUsuario(id: number, data: ActualizarUsuario): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.apiUrl}/${id}`, data);
  }

  eliminarUsuario(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
