import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageService } from './i18n/language.service';
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

  /** Injected for its side effect: keeps `<html lang>` synced from app bootstrap onward. */
  private readonly languageService = inject(LanguageService);
}
