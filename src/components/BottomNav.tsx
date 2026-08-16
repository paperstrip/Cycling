/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Zap, Compass, MessageSquare, Calendar, Activity, History } from 'lucide-react';
import type { MainNavTab } from '../App';

export interface NavItem {
  id: MainNavTab;
  /** Libellé court, pour la barre basse mobile. */
  short: string;
  /** Libellé complet, pour la navigation de bureau. */
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'workouts', short: 'Séances', label: 'Séances', icon: Zap },
  { id: 'routes', short: 'Parcours', label: 'Itinéraires & GPS', icon: Compass },
  { id: 'coach', short: 'Coach', label: 'Coach DS', icon: MessageSquare },
  { id: 'program', short: 'Plan', label: 'Programme', icon: Calendar },
  { id: 'history', short: 'Sorties', label: 'Historique', icon: History },
  { id: 'profile', short: 'Profil', label: 'Profil & Zones', icon: Activity },
];

interface BottomNavProps {
  activeTab: MainNavTab;
  onSelect: (tab: MainNavTab) => void;
}

/**
 * Barre de navigation basse (mobile) : toutes les destinations sont atteignables
 * au pouce, sans défilement horizontal.
 */
export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelect }) => {
  return (
    <nav
      aria-label="Navigation principale"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-stone-950/95 backdrop-blur-lg border-t border-stone-800 px-safe pb-safe"
    >
      <div className="flex items-stretch justify-around h-[4.5rem] pt-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isSelected = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              aria-current={isSelected ? 'page' : undefined}
              className={`relative flex-1 flex flex-col items-center justify-start gap-1 pt-1.5 cursor-pointer transition-colors ${
                isSelected ? 'text-amber-400' : 'text-stone-500 active:text-stone-300'
              }`}
            >
              {/* Repère de l'onglet actif */}
              <span
                className={`absolute top-0 h-0.5 w-8 rounded-full transition-all ${
                  isSelected ? 'bg-amber-400' : 'bg-transparent'
                }`}
              />
              <Icon className="w-[1.35rem] h-[1.35rem]" />
              <span className="text-[9.5px] font-bold tracking-tight leading-none">
                {item.short}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
