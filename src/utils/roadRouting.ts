/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Calage d'un tracé sur de vraies routes.
 *
 * Les parcours étaient jusqu'ici des cercles mathématiques : un rayon déduit de
 * la distance visée, quelques sinus pour que la boucle ne soit pas parfaitement
 * ronde, et un dénivelé entièrement inventé à coups de sinusoïdes. Le tracé ne
 * suivait donc aucune route — il pouvait traverser un lac, une voie ferrée ou
 * une autoroute — alors que l'écran annonçait « vraies routes ».
 *
 * On demande désormais l'itinéraire à un routeur cyclable, qui suit le réseau
 * routier réel d'OpenStreetMap.
 *
 * Deux fournisseurs, essayés dans l'ordre, tous deux gratuits et sans clé :
 * BRouter d'abord parce qu'il renvoie l'altitude, OSRM ensuite. Si aucun ne
 * répond, l'appelant retombe sur l'estimation géométrique — mais elle doit
 * alors être signalée comme telle, jamais présentée comme un vrai parcours.
 */

export interface RoutedPath {
  points: { lat: number; lng: number; ele: number }[];
  distanceKm: number;
  /** Dénivelé positif réel, ou `null` si le fournisseur ne le donne pas. */
  ascentM: number | null;
  provider: 'brouter' | 'osrm';
}

export type BikeProfile = 'route' | 'gravel' | 'clm' | 'polyvalent';

/** Profil BRouter correspondant au type de vélo. */
function brouterProfile(bike: BikeProfile): string {
  if (bike === 'gravel') return 'gravel';
  if (bike === 'clm') return 'fastbike';
  return 'trekking';
}

/** Les serveurs communautaires peuvent être lents : on ne bloque pas l'écran. */
const REQUEST_TIMEOUT_MS = 9000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function viaBrouter(
  anchors: { lat: number; lng: number }[],
  bike: BikeProfile,
): Promise<RoutedPath | null> {
  const lonlats = anchors.map((a) => `${a.lng.toFixed(6)},${a.lat.toFixed(6)}`).join('|');
  const url =
    `https://brouter.de/brouter?lonlats=${lonlats}` +
    `&profile=${brouterProfile(bike)}&alternativeidx=0&format=geojson`;

  const response = await fetchWithTimeout(url);
  if (!response.ok) return null;

  const data = await response.json();
  const feature = data?.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const properties = feature.properties || {};
  const lengthM = Number(properties['track-length']);
  const ascend = Number(properties['filtered ascend']);

  return {
    // BRouter renvoie [lon, lat, altitude].
    points: coordinates.map((c: number[]) => ({
      lat: c[1],
      lng: c[0],
      ele: Number.isFinite(c[2]) ? Math.round(c[2]) : 0,
    })),
    distanceKm: Number.isFinite(lengthM) ? lengthM / 1000 : 0,
    ascentM: Number.isFinite(ascend) ? Math.round(ascend) : null,
    provider: 'brouter',
  };
}

async function viaOsrm(anchors: { lat: number; lng: number }[]): Promise<RoutedPath | null> {
  const coords = anchors.map((a) => `${a.lng.toFixed(6)},${a.lat.toFixed(6)}`).join(';');
  const url =
    `https://routing.openstreetmap.de/routed-bike/route/v1/driving/${coords}` +
    `?overview=full&geometries=geojson`;

  const response = await fetchWithTimeout(url);
  if (!response.ok) return null;

  const data = await response.json();
  const route = data?.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  return {
    points: coordinates.map((c: number[]) => ({ lat: c[1], lng: c[0], ele: 0 })),
    distanceKm: Number(route.distance) / 1000,
    // OSRM ne fournit pas d'altitude : mieux vaut l'avouer que l'inventer.
    ascentM: null,
    provider: 'osrm',
  };
}

/**
 * Cale une suite de points d'ancrage sur le réseau routier.
 *
 * Retourne `null` si aucun fournisseur ne répond — hors connexion, serveur
 * indisponible, ou zone sans données. L'appelant doit alors le signaler.
 */
export async function snapToRoads(
  anchors: { lat: number; lng: number }[],
  bike: BikeProfile = 'route',
): Promise<RoutedPath | null> {
  if (anchors.length < 2) return null;

  for (const attempt of [() => viaBrouter(anchors, bike), () => viaOsrm(anchors)]) {
    try {
      const result = await attempt();
      if (result && result.points.length >= 2 && result.distanceKm > 0) return result;
    } catch {
      // Fournisseur injoignable : on passe au suivant.
    }
  }
  return null;
}
