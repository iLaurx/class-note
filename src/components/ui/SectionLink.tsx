import { ArrowUpRight } from 'lucide-react';
import type { NavigationItem } from '../../app/navigation';

export function SectionLink({ item }: { item: NavigationItem }) {
  const Icon = item.icon;
  return (
    <a className="quick-link" href={item.href}>
      <span className="icon-tile">
        <Icon size={21} aria-hidden="true" />
      </span>
      <span>{item.label}</span>
      <ArrowUpRight size={17} className="ml-auto" aria-hidden="true" />
    </a>
  );
}
