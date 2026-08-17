/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Zap, Compass, MessageSquare, Calendar, Activity, History, Play } from 'lucide-react';
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

/**
 * Destinations de la barre basse : quatre, plus le bouton central.
 *
 * Les six onglets tenaient sur une ligne mais chaque cible faisait moins de
 * 60 px de large, avec des libellés de 9 px. Le coach garde sa place ici, à
 * portée de pouce : c'est une destination qu'on ouvre en cours de journée,
 * pas seulement depuis l'accueil. « Parcours » et « Profil » sortent de la
 * barre — le premier devient une entrée de l'accueil, le second s'ouvre en
 * touchant l'avatar de l'en-tête.
 */
const BAR_TABS: MainNavTab[] = ['workouts', 'coach', 'program', 'history'];

interface BottomNavProps {
  activeTab: MainNavTab;
  onSelect: (tab: MainNavTab) => void;
  /** Action principale du bouton central : lancer la séance sélectionnée. */
  onPrimaryAction: () => void;
}

/**
 * Barre de navigation basse (mobile).
 *
 * Barre flottante détachée du bord plutôt que bandeau collé : le contenu
 * défile visiblement dessous, et le bouton d'action principal peut déborder
 * vers le haut au centre, là où le pouce tombe naturellement.
 */
export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelect, onPrimaryAction }) => {
  const items = BAR_TABS.map((id) => NAV_ITEMS.find((n) => n.id === id)!);
  const left = items.slice(0, 2);
  const right = items.slice(2);

  const renderTab = (item: NavItem) => {
    const Icon = item.icon;
    const isSelected = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onSelect(item.id)}
        aria-current={isSelected ? 'page' : undefined}
        className={`flex-1 h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
          isSelected ? 'text-amber-400' : 'text-stone-500 active:text-stone-300'
        }`}
      >
        <Icon className="w-[1.3rem] h-[1.3rem]" />
        <span className="text-[9.5px] font-bold tracking-tight leading-none">{item.short}</span>
      </button>
    );
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-page pb-safe-3 pointer-events-none">
      <nav
        aria-label="Navigation principale"
        className="relative pointer-events-auto max-w-md mx-auto h-[4.25rem] rounded-[26px] bg-stone-900/95 backdrop-blur-xl border border-stone-800 shadow-2xl shadow-stone-950/60 flex items-stretch"
      >
        {left.map(renderTab)}

        {/* Réserve la place du bouton central, qui déborde vers le haut */}
        <div className="w-[4.5rem] shrink-0" aria-hidden="true" />

        {right.map(renderTab)}

        <button
          onClick={onPrimaryAction}
          aria-label="Démarrer la séance"
          className="absolute left-1/2 -translate-x-1/2 -top-5 w-[3.75rem] h-[3.75rem] rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center justify-center cursor-pointer transition-colors shadow-lg shadow-amber-500/30 ring-4 ring-stone-950"
        >
          <Play className="w-6 h-6 fill-stone-950 translate-x-[1px]" />
        </button>
      </nav>
    </div>
  );
};
