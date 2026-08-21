export type ButtonVariant = 'primary' | 'secondary' | 'danger';

const BASE_CLASSES =
  'inline-block cursor-pointer rounded-full px-5 py-2 font-heading font-bold tracking-wide shadow-md transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm disabled:pointer-events-none disabled:opacity-50';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-treasure-500 text-ocean-950 hover:bg-treasure-400',
  secondary:
    'border-2 border-ocean-700 bg-transparent text-ocean-700 hover:bg-ocean-700 hover:text-parchment-50',
  danger: 'bg-flag-500 text-parchment-50 hover:bg-flag-600',
};

/** Shared so both `Button` and plain links styled as buttons (e.g. Logout) stay visually identical. */
export function buttonClasses(variant: ButtonVariant): string {
  return `${BASE_CLASSES} ${VARIANT_CLASSES[variant]}`;
}
