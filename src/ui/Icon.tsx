import {
  IconBabyCarriage,
  IconBackpack,
  IconBellPlus,
  IconBriefcase,
  IconBuilding,
  IconCalendarCheck,
  IconCar,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheckFilled,
  IconClock,
  IconDots,
  IconFirstAidKit,
  IconHeartHandshake,
  IconHome,
  IconPaw,
  IconPlane,
  IconPlus,
  IconScan,
  IconSearch,
  IconSettings,
  IconShoppingBag,
  IconShoppingCart,
  IconTrees,
  IconUsers,
} from '@tabler/icons-react-native';

import type { CabinetIcon } from '@/domain/places';

import { colors } from './theme';

/**
 * The app's icons: Tabler, as in the design. Only the ones in use are imported,
 * by name, so the bundle does not carry the whole set.
 */
const ICONS = {
  'baby-carriage': IconBabyCarriage,
  backpack: IconBackpack,
  'bell-plus': IconBellPlus,
  briefcase: IconBriefcase,
  building: IconBuilding,
  'calendar-check': IconCalendarCheck,
  car: IconCar,
  check: IconCheck,
  'chevron-down': IconChevronDown,
  'chevron-left': IconChevronLeft,
  'chevron-right': IconChevronRight,
  'circle-check-filled': IconCircleCheckFilled,
  clock: IconClock,
  dots: IconDots,
  'first-aid-kit': IconFirstAidKit,
  'heart-handshake': IconHeartHandshake,
  home: IconHome,
  paw: IconPaw,
  plane: IconPlane,
  plus: IconPlus,
  scan: IconScan,
  search: IconSearch,
  settings: IconSettings,
  'shopping-bag': IconShoppingBag,
  'shopping-cart': IconShoppingCart,
  trees: IconTrees,
  users: IconUsers,
} satisfies Record<CabinetIcon, unknown> & Record<string, unknown>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 24,
  color = colors.inkMuted,
  strokeWidth = 1.75,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const Component = ICONS[name];
  return <Component size={size} color={color} strokeWidth={strokeWidth} />;
}
