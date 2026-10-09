// Category navigation for the services catalog. المسؤول: abed alrahman.

import { useEffect, useRef } from 'react';

import { CATEGORIES } from '../categories';
import type { ServiceCategory } from '../../../../../shared/types';


interface CategoryTabsProps {
  active: ServiceCategory;
  onChange: (category: ServiceCategory) => void;
}


export function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // #explain_notes: On narrow screens the tab row scrolls sideways; keep the active tab visible.
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [active]);

  return (
    <div className="category-tabs" role="tablist" aria-label="Service categories">
      {CATEGORIES.map((category) => (
        <button
          key={category.id}
          ref={category.id === active ? activeTabRef : undefined}
          type="button"
          role="tab"
          aria-selected={category.id === active}
          className={`category-tab${category.id === active ? ' category-tab--active' : ''}`}
          onClick={() => onChange(category.id)}
        >
          <span className="category-tab__icon" aria-hidden="true">{category.icon}</span>
          <span>{category.label}</span>
        </button>
      ))}
    </div>
  );
}
