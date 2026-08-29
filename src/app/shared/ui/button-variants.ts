export type ButtonVariant = 'primary' | 'secondary' | 'danger';

const BASE_CLASSES =
  'inline-block cursor-pointer rounded-lg px-4 py-2 font-heading text-sm font-semibold shadow-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm disabled:pointer-events-none disabled:opacity-50';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-treasure-500 text-ocean-950 hover:bg-treasure-400',
  secondary:
    'bg-parchment-100 text-ocean-700 ring-2 ring-inset ring-ocean-700/25 hover:bg-ocean-700 hover:text-parchment-100 hover:ring-ocean-700',
  danger: 'bg-flag-600 text-parchment-100 hover:bg-flag-700',
};

/** Shared so both `Button` and plain links styled as buttons (e.g. Logout) stay visually identical. */
export function buttonClasses(variant: ButtonVariant): string {
  return `${BASE_CLASSES} ${VARIANT_CLASSES[variant]}`;
}
