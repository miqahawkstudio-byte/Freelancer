import { Utensils, Camera, BarChart2, User } from 'lucide-react';
import type { Screen } from '../types';

interface Props {
  current: Screen;
  onNavigate: (s: Screen) => void;
}

const TABS = [
  { id: 'diary' as Screen, label: 'Dziennik', Icon: Utensils },
  { id: 'camera' as Screen, label: 'Aparat', Icon: Camera },
  { id: 'history' as Screen, label: 'Historia', Icon: BarChart2 },
  { id: 'profile' as Screen, label: 'Profil', Icon: User },
];

const NAV_SCREENS: Screen[] = ['diary', 'camera', 'history', 'profile'];

export default function Navigation({ current, onNavigate }: Props) {
  const active = NAV_SCREENS.includes(current) ? current : 'diary';

  return (
    <nav className="flex-shrink-0 bg-white border-t border-gray-200 safe-bottom">
      <div className="flex">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              active === id ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon
              size={22}
              strokeWidth={active === id ? 2.5 : 1.8}
            />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
