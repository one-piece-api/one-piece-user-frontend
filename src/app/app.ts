import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastViewport } from './shared/toast/toast-viewport';
import { AppShell } from './shared/ui/app-shell';

@Component({
  imports: [RouterOutlet, AppShell, ToastViewport],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('user-frontend');
}
