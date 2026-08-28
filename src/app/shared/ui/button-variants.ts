export type ButtonVariant = 'primary' | 'secondary' | 'danger';

const BASE_CLASSES =
  'inline-block cursor-pointer rounded-lg px-4 py-2 font-heading text-sm font-semibold shadow-sm transition-colors duration-150 hover:shadow-md disabled:pointer-events-none disabled:opacity-50';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-treasure-500 text-ocean-950 hover:bg-treasure-400',
  secondary: 'bg-parchment-200 text-ocean-500 hover:bg-parchment-200/70',
  danger: 'bg-flag-600 text-parchment-100 hover:bg-flag-700',
};

/** Shared so both `Button` and plain links styled as buttons (e.g. Logout) stay visually identical. */
export function buttonClasses(variant: ButtonVariant): string {
  return `${BASE_CLASSES} ${VARIANT_CLASSES[variant]}`;
}
