/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { IllustrationPreference } from '../types';
import { WorkoutArtwork, type ArtworkVariant } from './WorkoutArtwork';

/** Numéro de photo associé à chaque type de séance. */
const PHOTO_INDEX: Record<ArtworkVariant, number> = {
  col: 1,
  chrono: 2,
  route: 3,
  recup: 4,
};

/** Photos hors séance, adressées par nom. */
export type StandalonePhoto = 'coach' | 'parcours';
const STANDALONE_INDEX: Record<StandalonePhoto, number> = { coach: 5, parcours: 6 };

/** La vue aérienne n'a pas de variante : personne n'y est reconnaissable. */
const NO_VARIANT = new Set([6]);

/**
 * Choisit la série à afficher.
 *
 * En mode « varie », le tirage est déterministe et dérivé de la clé passée :
 * une même séance montre toujours la même photo — sinon l'image changerait à
 * chaque rendu de React, ce qui donnerait l'impression d'un bug — mais les
 * séances entre elles alternent.
 */
function variantSuffix(index: number, preference: IllustrationPreference, key: string): string {
  if (NO_VARIANT.has(index)) return '';
  if (preference === 'femme') return '-w';
  if (preference === 'homme') return '-m';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash) % 2 === 0 ? '-w' : '-m';
}

interface WorkoutPhotoProps {
  /** Type de séance, ou photo autonome. */
  subject: ArtworkVariant | StandalonePhoto;
  /** Clé stable servant à l'alternance (nom de la séance, par exemple). */
  photoKey: string;
  preference?: IllustrationPreference;
  className?: string;
  /** Cadrage, quand le sujet n'est pas au centre du carré source. */
  objectPosition?: string;
}

/**
 * Photo d'ambiance, avec repli sur l'illustration vectorielle.
 *
 * Le repli n'est pas décoratif : si un fichier manque ou ne se charge pas hors
 * connexion, la carte doit rester habillée plutôt que d'afficher un cadre vide.
 */
export const WorkoutPhoto: React.FC<WorkoutPhotoProps> = ({
  subject,
  photoKey,
  preference,
  className = '',
  objectPosition = 'center',
}) => {
  const [hasFailed, setHasFailed] = useState(false);
  // `strict` étant désactivé, une valeur par défaut posée dans la
  // déstructuration élargirait le type de l'union à `string`.
  const resolvedPreference: IllustrationPreference = preference || 'varie';

  const isStandalone = subject === 'coach' || subject === 'parcours';
  const index = isStandalone
    ? STANDALONE_INDEX[subject as StandalonePhoto]
    : PHOTO_INDEX[subject as ArtworkVariant];

  // Repli : les photos autonomes empruntent l'illustration la plus proche.
  const fallbackVariant: ArtworkVariant = isStandalone
    ? subject === 'coach'
      ? 'chrono'
      : 'route'
    : (subject as ArtworkVariant);

  if (hasFailed) return <WorkoutArtwork variant={fallbackVariant} className={className} />;

  const src = `${import.meta.env.BASE_URL}image/image-${index}${variantSuffix(index, resolvedPreference, photoKey)}.webp`;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      onError={() => setHasFailed(true)}
      className={`object-cover ${className}`}
      style={{ objectPosition }}
    />
  );
};
