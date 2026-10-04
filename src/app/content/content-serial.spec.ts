import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MascotService } from '../shared/mascot/mascot';
import { provideTranslocoTesting } from '../testing/i18n-testing';
import { ContentSerial } from './content-serial';

describe('ContentSerial', () => {
  let fixture: ComponentFixture<ContentSerial>;
  let button: HTMLButtonElement;
  const writeText = vi.fn<(text: string) => Promise<void>>();

  beforeEach(() => {
    writeText.mockReset();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
    fixture = TestBed.createComponent(ContentSerial);
    fixture.componentRef.setInput('contentId', 'a97201d7-4c3e-4b1a-9f00-1234567890ab');
    fixture.detectChanges();
    button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
  });

  async function click(): Promise<void> {
    button.click();
    await fixture.whenStable();
  }

  it('shows the short serial with a tooltip saying what it is', () => {
    expect(button.textContent?.trim()).toBe('#A97201D7');
    expect(button.title).toContain('Identification code');
  });

  it('copies the serial on click and the mascot confirms', async () => {
    writeText.mockResolvedValue();

    await click();

    expect(writeText).toHaveBeenCalledWith('#A97201D7');
    expect(TestBed.inject(MascotService).message()).toEqual(
      expect.objectContaining({ tone: 'success', text: expect.stringContaining('#A97201D7') }),
    );
  });

  it('tells through the mascot when the clipboard refuses', async () => {
    writeText.mockRejectedValue(new Error('denied'));

    await click();

    expect(TestBed.inject(MascotService).message()).toEqual(
      expect.objectContaining({ tone: 'error', text: expect.stringContaining('by hand') }),
    );
  });
});
