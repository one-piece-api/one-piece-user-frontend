import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MascotWidget } from './shared/mascot/mascot-widget';
import { AppShell } from './shared/ui/app-shell';

@Component({
  imports: [RouterOutlet, AppShell, MascotWidget],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('user-frontend');
}
