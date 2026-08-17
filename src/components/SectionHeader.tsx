/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ChevronRight } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  /** Lien discret aligné à droite, façon « voir tout ». */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Titre de section unifié.
 *
 * Les écrans empilaient des en-têtes tous différents (tailles, casses,
 * sous-titres), ce qui brouillait la lecture. Un seul composant garantit que
 * chaque section se repère au même endroit, avec le même poids visuel.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  actionLabel,
  onAction,
}) => (
  <div className="flex items-baseline justify-between gap-3 mb-3">
    <h2 className="text-[15px] font-black text-white tracking-tight">{title}</h2>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="text-[11.5px] font-bold text-stone-400 hover:text-amber-400 flex items-center gap-0.5 cursor-pointer transition-colors shrink-0"
      >
        {actionLabel}
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);
