import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { WhoAmI } from './identity/who-am-i';
import { ToastViewport } from './shared/toast/toast-viewport';
import { Header } from './shared/ui/header';

@Component({
  imports: [RouterOutlet, WhoAmI, Header, ToastViewport],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('user-frontend');
}
