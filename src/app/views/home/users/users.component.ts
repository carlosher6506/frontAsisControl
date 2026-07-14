import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { UsersService } from '../../../core/services/users.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { AuthService } from '../../../core/services/auth.service';
import { Usuario, CrearUsuario, ActualizarUsuario } from '../../../core/models/user.model';

@Component({
  selector: 'app-users',
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {

  usuarios: Usuario[] = [];
  isLoading = true;
  isSubmitting = false;
  modoEdicion = false;
  usuarioSeleccionado: Usuario | null = null;

  roles = ['admin', 'maestro'];
  textoBusqueda = '';
  rolFiltro = '';
  paginaActual = 1;
  readonly pageSize = 10;

  form: FormGroup;

  constructor(
    private usersService: UsersService,
    private sweetAlert: SweetAlertService,
    private fb: FormBuilder,
    private authService: AuthService
  ){
    this.form = this.fb.group({
      nombre:   ['', [Validators.required, Validators.minLength(3)]],
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rol:      ['', Validators.required]
    });
  }


  ngOnInit(): void {

  const usuario = this.authService.getUsuario();

  if(usuario?.rol?.toLowerCase() !== 'admin'){
    this.isLoading = false;
    return;
  }

  this.cargarUsuarios();
}

  // ------ Gatters ------
  get nombre() {return this.form.get('nombre')!}
  get email() { return this.form.get('email')!; }
  get password() { return this.form.get('password')!; }
  get rol() { return this.form.get('rol')!; }

  get usuariosFiltrados(): Usuario[] {
    const busqueda = this.textoBusqueda.trim().toLocaleLowerCase();
    const rolSeleccionado = this.rolFiltro.toLocaleLowerCase();

    return this.usuarios
      .filter(usuario => {
        const coincideBusqueda = !busqueda ||
          usuario.nombre.toLocaleLowerCase().includes(busqueda) ||
          usuario.rol.toLocaleLowerCase().includes(busqueda);
        const coincideRol = !rolSeleccionado || usuario.rol.toLocaleLowerCase() === rolSeleccionado;

        return coincideBusqueda && coincideRol;
      })
      .sort((a, b) => {
        const prioridadRol = this.esAdministrador(a) === this.esAdministrador(b)
          ? 0
          : this.esAdministrador(a) ? -1 : 1;

        return prioridadRol ||
          a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }) ||
          a.email.localeCompare(b.email, 'es', { sensitivity: 'base' });
      });
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.usuariosFiltrados.length / this.pageSize));
  }

  get paginas(): number[] {
    const inicio = Math.max(1, this.paginaActual - 2);
    const fin = Math.min(this.totalPaginas, this.paginaActual + 2);
    return Array.from({ length: fin - inicio + 1 }, (_, indice) => inicio + indice);
  }

  get usuariosPaginados(): Usuario[] {
    const inicio = (this.paginaActual - 1) * this.pageSize;
    return this.usuariosFiltrados.slice(inicio, inicio + this.pageSize);
  }

  get primerRegistro(): number {
    return this.usuariosFiltrados.length ? (this.paginaActual - 1) * this.pageSize + 1 : 0;
  }

  get ultimoRegistro(): number {
    return Math.min(this.paginaActual * this.pageSize, this.usuariosFiltrados.length);
  }


  // ------ Cargar ------
  cargarUsuarios(): void {
    this.isLoading = true;
    this.usersService.obtenerUsuarios().subscribe({
      next: (data) => {
        this.usuarios = data;
        this.paginaActual = 1;
        this.isLoading = false;
      },
      error: () => {
        this.sweetAlert.error('Error', 'No se pudieron cargar los usuarios');
        this.isLoading = false;
      }
    });
  }

  // ------ Abrir modal para crear ------
  abrirModalCrear(): void {
    this.modoEdicion = false;
    this.usuarioSeleccionado = null;
    this.form.reset();
    // Password requerido al crear.
    this.password.enable();
    this.password.setValidators([Validators.required, Validators.minLength(6)]);
    this.password.updateValueAndValidity();
  }

  // ------ Abrir modal para editar ------
  abrirModalEditar(usuario: Usuario): void {
    this.modoEdicion = true;
    this.usuarioSeleccionado = usuario;
    // La contraseña se administra fuera de esta edición.
    this.password.reset();
    this.password.clearValidators();
    this.password.disable();
    this.form.patchValue({
      nombre: usuario.nombre,
      email:  usuario.email,
      rol:    usuario.rol,
      password: ''
    });
  }

  // ------ Guardar (crear o editar) ------
  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    if (this.modoEdicion && this.usuarioSeleccionado) {
      const data: ActualizarUsuario = {
        nombre: this.form.value.nombre,
        email:  this.form.value.email,
        rol:    this.form.value.rol
      };

      this.usersService.actualizarUsuario(this.usuarioSeleccionado.id, data).subscribe({
        next: () => {
          this.sweetAlert.toast('Usuario actualizado correctamente', 'success');
          this.cerrarModal();
          this.cargarUsuarios();
          this.isSubmitting = false;
        },
        error: () => {
          this.sweetAlert.error('Error', 'No se pudo actualizar el usuario');
          this.isSubmitting = false;
        }
      });

    } else {
      const data: CrearUsuario = this.form.value;

      this.usersService.crearUsuario(data).subscribe({
        next: () => {
          this.sweetAlert.toast('Usuario creado correctamente', 'success');
          this.cerrarModal();
          this.cargarUsuarios();
          this.isSubmitting = false;
        },
        error: () => {
          this.sweetAlert.error('Error', 'No se pudo crear el usuario');
          this.isSubmitting = false;
        }
      });
    }
  }

  // ------ Eliminar ------
  async eliminar(usuario: Usuario): Promise<void> {
    const result = await this.sweetAlert.confirmDelete(
      `¿Eliminar a ${usuario.nombre}?`,
      'Esta acción no se puede deshacer'
    );

    if (result.isConfirmed) {
      this.usersService.eliminarUsuario(usuario.id).subscribe({
        next: () => {
          this.sweetAlert.toast('Usuario eliminado', 'success');
          this.cargarUsuarios();
        },
        error: () => {
          this.sweetAlert.error('Error', 'No se pudo eliminar el usuario');
        }
      });
    }
  }

  // ------ Cerrar modal ------
  cerrarModal(): void {
    this.form.reset();
    this.modoEdicion = false;
    this.usuarioSeleccionado = null;
    // cierra el modal de Bootstrap programáticamente
    const modal = document.getElementById('modalUsuario');
    if (modal) {
      const bsModal = (window as any).bootstrap.Modal.getInstance(modal);
      bsModal?.hide();
    }
  }

  onFiltrosChange(): void {
    this.paginaActual = 1;
  }

  limpiarFiltros(): void {
    this.textoBusqueda = '';
    this.rolFiltro = '';
    this.paginaActual = 1;
  }

  cambiarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
    }
  }

  private esAdministrador(usuario: Usuario): boolean {
    const rol = usuario.rol.toLocaleLowerCase();
    return rol === 'admin' || rol === 'administrador';
  }
}
