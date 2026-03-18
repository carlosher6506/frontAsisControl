import { Routes } from '@angular/router';
import { LoginComponent } from './views/auth/login/login.component';
import { authGuard } from './views/guards/auth.guard';
import { noAuthGuard } from './views/guards/no-auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [noAuthGuard]
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./views/dashboard/dashboard/dashboard.component').then(m => m.DashboardComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./views/dashboard/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./views/dashboard/users/users.component').then(m => m.UsersComponent)
      },
      {
        path: 'students',
        loadComponent: () =>
          import('./views/dashboard/students/students.component').then(m => m.StudentsComponent)
      },
      {
        path: 'groups',
        loadComponent: () =>
          import('./views/dashboard/groups/groups.component').then(m => m.GroupsComponent)
      },
      {
        path: 'schoolYear',
        loadComponent: () =>
          import('./views/dashboard/school-year/school-year.component').then(m => m.SchoolYearComponent)
      },
      {
        path: 'levels',
        loadComponent: () =>
          import('./views/dashboard/levels/levels.component').then(m => m.LevelsComponent)
      },
      { path: '**', redirectTo: '' }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
