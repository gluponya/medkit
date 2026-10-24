/**
 * Where a cabinet is kept, and what follows from it (docs/model.md, "Cabinet").
 * The place presets the icon and the mode; both can be changed.
 */

export const PLACES = ['home', 'car', 'dacha', 'parents', 'other'] as const;
export type Place = (typeof PLACES)[number];

export type CabinetMode = 'expiry_only' | 'with_intake';

/** The twelve icons a cabinet can wear, in the order the picker shows them. */
export const CABINET_ICONS = [
  'home',
  'car',
  'trees',
  'heart-handshake',
  'first-aid-kit',
  'briefcase',
  'backpack',
  'plane',
  'building',
  'baby-carriage',
  'paw',
  'shopping-bag',
] as const;
export type CabinetIcon = (typeof CABINET_ICONS)[number];

const DEFAULT_ICON: Record<Place, CabinetIcon> = {
  home: 'home',
  car: 'car',
  dacha: 'trees',
  parents: 'heart-handshake',
  other: 'first-aid-kit',
};

export function defaultIcon(place: Place): CabinetIcon {
  return DEFAULT_ICON[place];
}

/** Only home takes intake by default; elsewhere the dates are what matters. */
export function defaultMode(place: Place): CabinetMode {
  return place === 'home' ? 'with_intake' : 'expiry_only';
}
