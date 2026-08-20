import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { WhoAmI } from './identity/who-am-i';

@Component({
  imports: [RouterOutlet, WhoAmI],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('user-frontend');
}
