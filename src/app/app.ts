import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastViewport } from './shared/toast/toast-viewport';
import { Header } from './shared/ui/header';

@Component({
  imports: [RouterOutlet, Header, ToastViewport],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('user-frontend');
}
