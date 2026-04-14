import { Routes } from '@angular/router';
import { LoginComponent } from './views/auth/login/login.component';
import { authGuard } from './views/guards/auth.guard';
import { noAuthGuard } from './views/guards/no-auth.guard';
import { RegisterComponent } from './views/auth/register/register.component';
import { StudentGradesComponent } from './views/auth/student-grades/student-grades.component';

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
    path: 'register',
    component: RegisterComponent,
    canActivate: [noAuthGuard]
  },
  {
    path: 'student-grades',
    component: StudentGradesComponent
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
      {
        path: 'evaluations',
        loadComponent: () =>
          import('./views/dashboard/evaluations/evaluations.component').then(m => m.EvaluationsComponent)
      },
      {
        path: 'subjects',
        loadComponent: () =>
          import('./views/dashboard/subjects/subjects.component').then(m => m.SubjectsComponent)
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./views/dashboard/tasks/tasks.component').then(m => m.TasksComponent)
      },
      {
        path: 'ratings',
        loadComponent: () =>
          import('./views/dashboard/ratings/ratings.component').then(m => m.RatingsComponent)
      },
      { path: 'profile',
        loadComponent: () =>
          import('./views/dashboard/profile/profile.component').then(m => m.ProfileComponent)
      },
      { path: '**', redirectTo: '' }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
