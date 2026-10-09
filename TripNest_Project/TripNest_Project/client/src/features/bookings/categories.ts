// Service category labels and the booking fields each category uses. المسؤول: abed alrahman.

import type { ServiceCategory } from '../../../../shared/types';


export interface CategoryInfo {
  id: ServiceCategory;
  label: string;
  icon: string;
  description: string;
}


export const CATEGORIES: CategoryInfo[] = [
  { id: 'flight', label: 'Flights', icon: '✈', description: 'Flights to and from your destination' },
  { id: 'train', label: 'Trains', icon: '🚆', description: 'High-speed and regional trains' },
  { id: 'ferry', label: 'Ferries', icon: '⛴', description: 'Island and cross-sea ferries' },
  { id: 'hotel', label: 'Hotels', icon: '🏨', description: 'Rooms priced per night' },
  { id: 'esim', label: 'eSIM', icon: '📶', description: 'Mobile data packages' },
  { id: 'transfer', label: 'Transport & transfers', icon: '🚕', description: 'Airport transfers and city passes' },
  { id: 'activity', label: 'Activities & events', icon: '🎟', description: 'Tours, attractions, and event tickets' },
];


export const TRANSPORT_CATEGORIES: ServiceCategory[] = ['flight', 'train', 'ferry'];


export function isServiceCategory(value: string | null): value is ServiceCategory {
  return CATEGORIES.some((category) => category.id === value);
}


export function categoryInfo(category: ServiceCategory): CategoryInfo {
  return CATEGORIES.find((item) => item.id === category) || CATEGORIES[0];
}
