export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: string;
}

export interface CrearUsuario {
  nombre: string;
  email: string;
  password: string;
  rol: string;
}

export interface ActualizarUsuario {
  nombre: string;
  email: string;
  rol: string;
}
