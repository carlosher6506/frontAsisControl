import { Routes } from '@angular/router';
import { LoginComponent } from './views/auth/login/login.component';
import { authGuard } from './views/guards/auth.guard';
import { noAuthGuard } from './views/guards/no-auth.guard';
import { StudentGradesComponent } from './views/auth/student-grades/student-grades.component';
import { AuthCallbackComponent } from './views/auth/auth-callback/auth-callback.component';

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
  { path: 'auth/callback', component: AuthCallbackComponent },
  {
    path: 'student-grades',
    component: StudentGradesComponent
  },
  {
    path: 'verificar-email',
    loadComponent: () => import('./views/auth/verify-email/verify-email.component')
      .then(m => m.VerifyEmailComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./views/auth/reset-password/reset-password.component')
      .then(m => m.ResetPasswordComponent)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./views/home/dashboard/dashboard.component').then(m => m.DashboardComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./views/home/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./views/home/users/users.component').then(m => m.UsersComponent)
      },
      {
        path: 'students',
        loadComponent: () =>
          import('./views/home/students/students.component').then(m => m.StudentsComponent)
      },
      {
        path: 'groups',
        loadComponent: () =>
          import('./views/home/groups/groups.component').then(m => m.GroupsComponent)
      },
      {
        path: 'schoolYear',
        loadComponent: () =>
          import('./views/home/school-year/school-year.component').then(m => m.SchoolYearComponent)
      },
      {
        path: 'levels',
        loadComponent: () =>
          import('./views/home/levels/levels.component').then(m => m.LevelsComponent)
      },
      {
        path: 'evaluations',
        loadComponent: () =>
          import('./views/home/evaluations/evaluations.component').then(m => m.EvaluationsComponent)
      },
      {
        path: 'subjects',
        loadComponent: () =>
          import('./views/home/subjects/subjects.component').then(m => m.SubjectsComponent)
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./views/home/tasks/tasks.component').then(m => m.TasksComponent)
      },
      {
        path: 'ratings',
        loadComponent: () =>
          import('./views/home/ratings/ratings.component').then(m => m.RatingsComponent)
      },
      { path: 'profile',
        loadComponent: () =>
          import('./views/home/profile/profile.component').then(m => m.ProfileComponent)
      },
      { path: '**', redirectTo: '' }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
