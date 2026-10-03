/**
 * jsdom does not implement `<dialog>`'s `showModal()` / `close()` yet - every browser this
 * app targets does, so this only fills a gap of the test environment: opening sets the
 * `open` attribute, closing removes it and fires `close`, as a browser would.
 */
export function polyfillDialog(): void {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}
