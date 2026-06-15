import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UsersService } from '../../../core/services/users.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { Usuario, CrearUsuario, ActualizarUsuario } from '../../../core/models/user.model';

@Component({
  selector: 'app-users',
  imports: [CommonModule, ReactiveFormsModule],
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

  form: FormGroup;

  constructor(
    private usersService: UsersService,
    private sweetAlert: SweetAlertService,
    private fb: FormBuilder
  ){
    this.form = this.fb.group({
      nombre:   ['', [Validators.required, Validators.minLength(3)]],
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rol:      ['', Validators.required]
    });
  }


  ngOnInit(): void {
    this.cargarUsuarios();
  }


  // ------ Gatters ------
  get nombre() {return this.form.get('nombre')!}
  get email() { return this.form.get('email')!; }
  get password() { return this.form.get('password')!; }
  get rol() { return this.form.get('rol')!; }


  // ------ Cargar ------
  cargarUsuarios(): void {
    this.isLoading = true;
    this.usersService.obtenerUsuarios().subscribe({
      next: (data) => {
        this.usuarios = data;
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
    // password requerido al crear
    this.form.get('password')!.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.get('password')!.updateValueAndValidity();
  }

  // ------ Abrir modal para editar ------
  abrirModalEditar(usuario: Usuario): void {
    this.modoEdicion = true;
    this.usuarioSeleccionado = usuario;
    // password no requerido al editar
    this.form.get('password')!.clearValidators();
    this.form.get('password')!.updateValueAndValidity();
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

  // ------ Badge color por rol ------
  getBadgeRol(rol: string): string {
    return rol === 'admin' ? 'bg-dark' : 'bg-secondary';
  }
}
