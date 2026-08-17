/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface ScreenTitleProps {
  /** Ligne discrète au-dessus du titre. */
  eyebrow?: string;
  title: string;
  /**
   * Deuxième moitié du titre, mise en couleur d'accent — le titre se lit alors
   * en deux temps, comme dans les maquettes de référence.
   */
  accent?: string;
  /** Bouton rond aligné à droite (réglages, notifications…). */
  action?: React.ReactNode;
}

/**
 * Titre d'écran.
 *
 * Volontairement très gros : c'est ce qui donne son caractère à l'app et ce qui
 * permet de savoir où l'on est sans lire la barre de navigation. Capitales,
 * graisse maximale, interlignage serré — la pile de polices système fournit
 * SF Pro sur iPhone, qui tient parfaitement à cette taille.
 */
export const ScreenTitle: React.FC<ScreenTitleProps> = ({ eyebrow, title, accent, action }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      {eyebrow && <p className="text-[13px] text-stone-400 mb-1">{eyebrow}</p>}
      <h1 className="text-[32px] leading-[0.95] font-black tracking-[-0.02em] text-white uppercase">
        {title}
        {accent && (
          <>
            {' '}
            <span className="text-amber-400">{accent}</span>
          </>
        )}
      </h1>
    </div>
    {action && <div className="shrink-0 pt-1">{action}</div>}
  </div>
);
