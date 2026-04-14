export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  usuario: any;
}

export interface RegistroRequest {
  nombre: string;
  email: string;
  password: string;
}
