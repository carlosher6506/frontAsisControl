import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { ProfileService } from '../../../core/services/profile.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { PerfilMaestro } from '../../../core/models/profile.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {

  perfil: PerfilMaestro | null = null;
  isLoading = true;
  isSubmitting = false;
  form: FormGroup;

  constructor(
    private profileService: ProfileService,
    private authService: AuthService,
    private sweetAlert: SweetAlertService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      nombre:            [''],
      apellido:          [''],
      telefono:          [''],
      curp:              [''],
      rfc:               [''],
      especialidad:      [''],
      carrera:           [''],
      direccion:         [''],
      codigo_classroom:  ['']
    });
  }

  ngOnInit(): void {
    this.cargarPerfil();
  }

  get usuario() { return this.authService.getUsuario(); }

  cargarPerfil(): void {
    this.isLoading = true;
    this.profileService.obtenerPerfil().subscribe({
      next: (data) =>{
        this.perfil = data;
        const nombreUsuario = this.usuario?.nombre || '';
        this.form.patchValue({
          nombre: data.nombre || nombreUsuario,
          apellido: data.apellido || '',
          telefono: data.telefono || '',
          curp: data.curp || '',
          rfc: data.rfc || '',
          especialidad: data.especialidad || '',
          carrera: data.carrera || '',
          direccion: data.direccion || '',
          codigo_classroom: data.codigo_classroom || ''
        });
        this.isLoading = false;
      },
      error: ()=>{
        this.form.patchValue({nombre: this.usuario?.nombre || ''});
        this.sweetAlert.error('Error', 'No se pudo cargar el perfil');
        this.isLoading = false;
      }
    })
  }

  guardar(): void {
    this.isSubmitting = true;
    this.profileService.guardarPerfil(this.form.value).subscribe({
      next: () => {
        this.sweetAlert.toast('Perfil actualizado correctamente', 'success');
        this.isSubmitting = false;
        this.cargarPerfil();
      },
      error: () => { this.sweetAlert.error('Error', 'No se pudo guardar'); this.isSubmitting = false; }
    });
  }
}
