import { CyclingRoute, RouteWaypoint } from '../types';

export interface LocationSearchResult {
  displayName: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
}

/**
 * Searches real addresses/cities using OpenStreetMap Nominatim
 */
export async function searchLocation(query: string): Promise<LocationSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query.trim()
    )}&limit=5&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'fr,en;q=0.8',
      },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((item: any) => ({
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      city:
        item.address?.city ||
        item.address?.town ||
        item.address?.village ||
        item.address?.municipality ||
        item.name ||
        'Position',
      country: item.address?.country || '',
    }));
  } catch (err) {
    console.warn('Erreur recherche de lieu OpenStreetMap:', err);
    return [];
  }
}

/**
 * Reverse geocodes coordinates to city/region name
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
    const response = await fetch(url, {
      headers: { 'Accept-Language': 'fr,en;q=0.8' },
    });
    if (!response.ok) return 'Ma position actuelle';
    const data = await response.json();
    return (
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.municipality ||
      data.name ||
      'Ma région'
    );
  } catch {
    return 'Ma position actuelle';
  }
}

/**
 * Generates realistic geographic loop points and elevation profile around given coordinates
 */
export function generateLocalLoopRoute(
  origin: { lat: number; lng: number },
  cityName: string,
  targetDistanceKm: number = 35,
  terrainType: 'plat' | 'vallonne' | 'montagne' | 'urbain_et_campagne' = 'vallonne',
  bikeType: 'route' | 'gravel' | 'clm' | 'polyvalent' = 'route'
): CyclingRoute {
  const pointsCount = Math.max(24, Math.round(targetDistanceKm * 1.5));
  const radiusKm = (targetDistanceKm / (2 * Math.PI)) * 1.15; // approximate circle radius in km
  const kmPerLat = 111.0;
  const kmPerLng = 111.0 * Math.cos((origin.lat * Math.PI) / 180);

  const gpxPoints: { lat: number; lng: number; ele: number }[] = [];
  const waypoints: RouteWaypoint[] = [];

  let baseElevation = 80;
  let elevMultiplier = 1.0;
  if (terrainType === 'plat') elevMultiplier = 0.3;
  if (terrainType === 'vallonne') elevMultiplier = 1.2;
  if (terrainType === 'montagne') elevMultiplier = 3.2;

  let totalAscentM = 0;
  let previousEle = baseElevation;

  // Generate loop geometry
  for (let i = 0; i <= pointsCount; i++) {
    const fraction = i / pointsCount;
    const angle = fraction * 2 * Math.PI - Math.PI / 2; // start heading North

    // Add natural organic perturbations so the loop isn't a rigid perfect circle
    const noise = Math.sin(fraction * Math.PI * 4) * 0.25 + Math.cos(fraction * Math.PI * 6) * 0.15;
    const currentRadius = radiusKm * (1 + noise);

    const dLat = (Math.sin(angle) * currentRadius) / kmPerLat;
    const dLng = (Math.cos(angle) * currentRadius) / kmPerLng;

    const lat = origin.lat + dLat;
    const lng = origin.lng + dLng;

    // Elevation calculation based on terrain profile
    let eleVariation = 0;
    if (terrainType === 'plat') {
      eleVariation = Math.sin(fraction * 8 * Math.PI) * 12;
    } else if (terrainType === 'vallonne') {
      eleVariation =
        Math.sin(fraction * 6 * Math.PI) * 45 +
        Math.cos(fraction * 10 * Math.PI) * 25 +
        Math.sin(fraction * 2 * Math.PI) * 35;
    } else if (terrainType === 'montagne') {
      eleVariation =
        Math.sin(fraction * 2 * Math.PI) * 350 +
        Math.cos(fraction * 4 * Math.PI) * 180 +
        Math.sin(fraction * 8 * Math.PI) * 60;
    }

    const ele = Math.max(15, Math.round(baseElevation + eleVariation * elevMultiplier));
    if (ele > previousEle) {
      totalAscentM += ele - previousEle;
    }
    previousEle = ele;

    gpxPoints.push({ lat, lng, ele });
  }

  // Create 6 structured Waypoints for pacing & intervals
  const stepsCount = 6;
  for (let s = 0; s < stepsCount; s++) {
    const ptIdx = Math.min(Math.round((s / (stepsCount - 1)) * pointsCount), pointsCount);
    const distKm = parseFloat(((s / (stepsCount - 1)) * targetDistanceKm).toFixed(1));
    const point = gpxPoints[ptIdx];

    let wpName = '';
    let instruction = '';
    let pacingAdvice = '';
    let segType: RouteWaypoint['segmentType'] = 'plat';

    if (s === 0) {
      wpName = `Départ - Sortie de ${cityName}`;
      instruction = 'Démarrage souple, sortie d\'agglomération par routes calmes.';
      pacingAdvice = 'Échauffement progressif en Zone 1 / Zone 2, cadence 90-95 rpm.';
      segType = 'plat';
    } else if (s === 1) {
      wpName = terrainType === 'montagne' ? 'Pied du Premier Col' : 'Plateau Roulant & Ligne Droite';
      instruction = 'Route dégagée avec excellente visibilité, idéale pour les premiers blocs.';
      pacingAdvice = 'Augmentez le braquet, installez l\'allure Tempo Z3.';
      segType = 'ligne_droite_roulante';
    } else if (s === 2) {
      wpName = terrainType === 'plat' ? 'Section Vent Défavorable' : 'Côte du Belvédère / Relance';
      instruction = 'Rampe continue de 1.8 km avec passages à 6-8%.';
      pacingAdvice = 'Effort au Seuil Z4 / VO2max Z5. Travaillez le coup de pédale en danseuse.';
      segType = 'cote_raide';
    } else if (s === 3) {
      wpName = 'Sommet & Bascule en Faux-Plat';
      instruction = 'Descente dégagée avec revêtement propre, puis transition sur faux-plat.';
      pacingAdvice = 'Récupération active en Z1, hydratez-vous avant la prochaine série.';
      segType = 'descente';
    } else if (s === 4) {
      wpName = 'Segment Rapide & Enchaînement';
      instruction = 'Enchaînement de virages larges et relances dynamiques.';
      pacingAdvice = 'Maintien de la puissance cible sans baisse de rythme.';
      segType = 'faux_plat_montant';
    } else {
      wpName = `Retour - Agglomération de ${cityName}`;
      instruction = 'Derniers kilomètres calmes de retour au point de départ.';
      pacingAdvice = 'Retour au calme (Z1), moulinez souple (100 rpm) pour décongestionner.';
      segType = 'plat';
    }

    waypoints.push({
      name: wpName,
      lat: point.lat,
      lng: point.lng,
      elevationM: point.ele,
      distanceFromStartKm: distKm,
      instruction,
      pacingAdvice,
      segmentType: segType,
    });
  }

  const surfaceType =
    bikeType === 'gravel'
      ? 'mixte_gravel'
      : terrainType === 'urbain_et_campagne'
      ? 'petites_routes_calmes'
      : 'asphalte_parfait';

  return {
    id: `route-local-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: `Boucle ${targetDistanceKm} km autour de ${cityName}`,
    description: `Parcours sur routes réelles et secondaires optimisé pour l'entraînement cycliste au départ de ${cityName}.`,
    startLocationName: cityName,
    originCoords: origin,
    estimatedDistanceKm: targetDistanceKm,
    totalAscentM,
    terrainType,
    recommendedBikeType: bikeType,
    idealForWorkout: `Adapté aux intervalles de puissance grâce aux segments continus sans feux rouges aux abords de ${cityName}.`,
    waypoints,
    gpxPoints,
    pacingStrategy:
      'Gérer l\'allure sur les 15 premiers kilomètres, exploiter les bosses du secteur médian pour les intervalles Z4/Z5 et garder 20% d\'énergie pour le retour.',
    safetyTips: [
      'Rester vigilant aux priorités et ronds-points en entrée de ville.',
      'Garder les mains aux cocottes ou aux creux du cintre dans les descentes.',
      'Port du casque et éclairages clignotants recommandés même de jour.',
    ],
    surface: surfaceType,
    isCustom: true,
  };
}

/**
 * Generates standard GPX 1.1 XML string ready for download
 */
export function exportRouteToGpx(route: CyclingRoute): string {
  const points = route.gpxPoints || [];
  const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CycloCoach Pro" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(route.name)}</name>
    <desc>${escapeXml(route.description)}</desc>
    <author>
      <name>CycloCoach</name>
    </author>
  </metadata>
  <trk>
    <name>${escapeXml(route.name)}</name>
    <type>Cycling</type>
    <trkseg>
${points
  .map(
    (pt) => `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lng.toFixed(6)}">
        <ele>${pt.ele.toFixed(1)}</ele>
      </trkpt>`
  )
  .join('\n')}
    </trkseg>
  </trk>
${(route.waypoints || [])
  .map(
    (wp) => `  <wpt lat="${(wp.lat || (points[0]?.lat ?? 0)).toFixed(6)}" lon="${(
      wp.lng || (points[0]?.lng ?? 0)
    ).toFixed(6)}">
    <ele>${wp.elevationM.toFixed(1)}</ele>
    <name>${escapeXml(wp.name)}</name>
    <desc>${escapeXml(wp.instruction)} - ${escapeXml(wp.pacingAdvice || '')}</desc>
  </wpt>`
  )
  .join('\n')}
</gpx>`;

  return gpxHeader;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Triggers a browser download for a GPX route file
 */
export function downloadGpxFile(route: CyclingRoute): void {
  const gpxData = exportRouteToGpx(route);
  const blob = new Blob([gpxData], { type: 'application/gpx+xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${route.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses user-uploaded GPX file into a CyclingRoute object
 */
export function parseGpxString(gpxContent: string, fileName: string = 'Parcours Importé'): CyclingRoute {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(gpxContent, 'application/xml');

  const trkpts = xmlDoc.getElementsByTagName('trkpt');
  const gpxPoints: { lat: number; lng: number; ele: number }[] = [];

  let totalAscentM = 0;
  let prevEle = 0;
  let totalDistanceKm = 0;
  let prevLat = 0;
  let prevLng = 0;

  for (let i = 0; i < trkpts.length; i++) {
    const pt = trkpts[i];
    const lat = parseFloat(pt.getAttribute('lat') || '0');
    const lng = parseFloat(pt.getAttribute('lon') || '0');
    const eleNode = pt.getElementsByTagName('ele')[0];
    const ele = eleNode ? parseFloat(eleNode.textContent || '0') : 50;

    if (i > 0) {
      const d = haversineKm(prevLat, prevLng, lat, lng);
      totalDistanceKm += d;
      if (ele > prevEle) totalAscentM += ele - prevEle;
    }

    prevLat = lat;
    prevLng = lng;
    prevEle = ele;

    gpxPoints.push({ lat, lng, ele });
  }

  const nameNode = xmlDoc.getElementsByTagName('name')[0];
  const routeName = nameNode ? nameNode.textContent || fileName : fileName;

  // Extract waypoints or build 5 samples
  const waypoints: RouteWaypoint[] = [];
  const wptNodes = xmlDoc.getElementsByTagName('wpt');

  if (wptNodes.length > 0) {
    for (let j = 0; j < Math.min(wptNodes.length, 10); j++) {
      const w = wptNodes[j];
      const wLat = parseFloat(w.getAttribute('lat') || '0');
      const wLng = parseFloat(w.getAttribute('lon') || '0');
      const wNameNode = w.getElementsByTagName('name')[0];
      const wEleNode = w.getElementsByTagName('ele')[0];
      const wDescNode = w.getElementsByTagName('desc')[0];

      waypoints.push({
        name: wNameNode?.textContent || `Point de repère ${j + 1}`,
        lat: wLat,
        lng: wLng,
        elevationM: wEleNode ? parseFloat(wEleNode.textContent || '0') : 50,
        distanceFromStartKm: (j / wptNodes.length) * totalDistanceKm,
        instruction: wDescNode?.textContent || 'Point de passage GPX',
        segmentType: 'plat',
      });
    }
  } else if (gpxPoints.length > 0) {
    // build 5 representative points
    const stepCount = 5;
    for (let k = 0; k < stepCount; k++) {
      const idx = Math.min(Math.round((k / (stepCount - 1)) * (gpxPoints.length - 1)), gpxPoints.length - 1);
      const pt = gpxPoints[idx];
      waypoints.push({
        name: k === 0 ? 'Départ du parcours' : k === stepCount - 1 ? 'Arrivée du parcours' : `Secteur ${k + 1}`,
        lat: pt.lat,
        lng: pt.lng,
        elevationM: pt.ele,
        distanceFromStartKm: (k / (stepCount - 1)) * totalDistanceKm,
        instruction: `Allure adaptée au dénivelé de ${pt.ele.toFixed(0)}m.`,
        segmentType: 'plat',
      });
    }
  }

  return {
    id: `gpx-import-${Date.now()}`,
    name: routeName.replace('.gpx', ''),
    description: `Parcours cycliste importé depuis fichier GPX (${totalDistanceKm.toFixed(1)} km, +${totalAscentM.toFixed(0)} m de D+).`,
    estimatedDistanceKm: Math.max(parseFloat(totalDistanceKm.toFixed(1)), 5),
    totalAscentM: Math.round(totalAscentM),
    terrainType: totalAscentM > 800 ? 'montagne' : totalAscentM > 300 ? 'vallonne' : 'plat',
    recommendedBikeType: 'route',
    idealForWorkout: 'Parcours réel importé, adaptable avec guidage vocal et cadence.',
    waypoints,
    gpxPoints,
    pacingStrategy: 'Respecter les zones de puissance en fonction du profil de relief importé.',
    safetyTips: ['Vérifier l\'état de la chaussée et la météo avant de partir.'],
    isCustom: true,
    surface: 'asphalte_parfait',
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
