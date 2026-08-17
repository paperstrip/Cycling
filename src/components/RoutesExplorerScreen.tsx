import React, { useState, useEffect, useRef } from 'react';
import { CyclingRoute, RouteWaypoint, CyclistProfile, WorkoutPlan } from '../types';
import {
  generateLocalLoopRoute,
  buildEstimatedLoopRoute,
  searchLocation,
  reverseGeocode,
  downloadGpxFile,
  parseGpxString,
  LocationSearchResult,
} from '../utils/localRouteEngine';
import { getSavedRoutes, saveCustomRoute, deleteCustomRoute } from '../utils/profileStorage';
import { PRESET_WORKOUTS } from '../data/presetWorkouts';
import {
  MapPin,
  Compass,
  Mountain,
  Download,
  Upload,
  Play,
  RotateCcw,
  Sparkles,
  Search,
  Bike,
  Route as RouteIcon,
  ShieldAlert,
  ChevronRight,
  TrendingUp,
  Layers,
  Check,
  Trash2,
  Bookmark,
  Share2,
} from 'lucide-react';
import L from 'leaflet';

interface RoutesExplorerScreenProps {
  cyclistProfile: CyclistProfile;
  activePlan?: WorkoutPlan;
  onSelectRouteForRide: (route: CyclingRoute, workoutPlan?: WorkoutPlan) => void;
  onUpdateProfileCity?: (city: string, coords: { lat: number; lng: number }) => void;
}

export const RoutesExplorerScreen: React.FC<RoutesExplorerScreenProps> = ({
  cyclistProfile,
  activePlan,
  onSelectRouteForRide,
  onUpdateProfileCity,
}) => {
  const [cityInput, setCityInput] = useState<string>(cyclistProfile.homeCity || 'Paris');
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>(
    cyclistProfile.homeCoordinates || { lat: 48.8566, lng: 2.3522 }
  );
  const [distanceKm, setDistanceKm] = useState<number>(40);
  const [terrain, setTerrain] = useState<'plat' | 'vallonne' | 'montagne' | 'urbain_et_campagne'>('vallonne');
  const [bikeType, setBikeType] = useState<'route' | 'gravel' | 'clm' | 'polyvalent'>('route');

  // L'état initial doit rester synchrone : le calage sur routes est un appel
  // réseau, il se fait juste après, au premier rendu.
  const [currentRoute, setCurrentRoute] = useState<CyclingRoute>(() => {
    const saved = getSavedRoutes();
    if (saved.length > 0) return saved[0];
    return buildEstimatedLoopRoute(
      cyclistProfile.homeCoordinates || { lat: 48.8566, lng: 2.3522 },
      cyclistProfile.homeCity || 'Paris',
      40,
      'vallonne',
      'route'
    );
  });
  const [isRouting, setIsRouting] = useState<boolean>(false);

  /**
   * Calcule un parcours et l'installe.
   *
   * Centralisé : les quatre points d'entrée — bouton, GPS, choix de ville,
   * premier rendu — doivent tous afficher l'attente et signaler un repli sur
   * l'estimation, sans quoi on croirait rouler sur un tracé réel.
   */
  const buildRoute = async (
    coords: { lat: number; lng: number },
    name: string,
    successMessage: string,
  ) => {
    setIsRouting(true);
    try {
      const route = await generateLocalLoopRoute(coords, name, distanceKm, terrain, bikeType);
      setCurrentRoute(route);
      setIsSaved(false);
      showNotice(
        route.routeSource === 'roads'
          ? successMessage
          : `${successMessage} — tracé approximatif : le service d'itinéraires est injoignable.`,
      );
    } catch {
      showNotice("Impossible de calculer l'itinéraire pour le moment.");
    } finally {
      setIsRouting(false);
    }
  };

  const [savedRoutesList, setSavedRoutesList] = useState<CyclingRoute[]>(getSavedRoutes());
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [activeWpIdx, setActiveWpIdx] = useState<number>(0);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Map container reference
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineLayerRef = useRef<L.Polyline | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [currentCoords.lat, currentCoords.lng],
        zoom: 11,
        zoomControl: true,
      });

      // CartoDB Dark Matter Tiles (High aesthetic dark map tiles)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      markersGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    // Draw or update Route Polyline
    if (polylineLayerRef.current) {
      polylineLayerRef.current.remove();
    }
    if (markersGroupRef.current) {
      markersGroupRef.current.clearLayers();
    }

    const gpxPoints = currentRoute.gpxPoints || [];
    if (gpxPoints.length > 0) {
      const latlngs: [number, number][] = gpxPoints.map((p) => [p.lat, p.lng]);
      const polyline = L.polyline(latlngs, {
        color: '#f59e0b',
        weight: 4,
        opacity: 0.9,
        lineJoin: 'round',
      }).addTo(map);

      polylineLayerRef.current = polyline;
      map.fitBounds(polyline.getBounds(), { padding: [30, 30] });

      // Add Start Marker
      if (latlngs[0]) {
        const startIcon = L.divIcon({
          className: 'custom-map-icon',
          html: `<div style="background-color:#10b981; color:#0c0a09; font-weight:900; font-size:10px; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #ffffff; box-shadow:0 2px 6px rgba(0,0,0,0.5);">D</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        L.marker(latlngs[0], { icon: startIcon })
          .bindPopup(`<strong>Départ & Arrivée</strong><br>${currentRoute.startLocationName || 'Départ'}`)
          .addTo(markersGroupRef.current!);
      }

      // Add Waypoint markers
      (currentRoute.waypoints || []).forEach((wp, idx) => {
        if (wp.lat && wp.lng && idx > 0 && idx < currentRoute.waypoints.length - 1) {
          const wpIcon = L.divIcon({
            className: 'custom-wp-icon',
            html: `<div style="background-color:#f59e0b; color:#0c0a09; font-weight:800; font-size:9px; width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #ffffff; box-shadow:0 2px 4px rgba(0,0,0,0.4);">${idx + 1}</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });
          L.marker([wp.lat, wp.lng], { icon: wpIcon })
            .bindPopup(`<strong>${wp.name}</strong><br>km ${wp.distanceFromStartKm.toFixed(1)} (${wp.elevationM}m)<br><em>${wp.instruction}</em>`)
            .addTo(markersGroupRef.current!);
        }
      });
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [currentRoute, currentCoords]);

  const handleGenerateNewRoute = () => {
    buildRoute(currentCoords, cityInput, `Nouvelle boucle de ${distanceKm} km à ${cityInput}`);
  };

  const handleDetectGps = () => {
    if (navigator.geolocation) {
      showNotice('Recherche de votre position GPS...');
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentCoords(coords);
          const detectedCity = await reverseGeocode(coords.lat, coords.lng);
          setCityInput(detectedCity);
          if (onUpdateProfileCity) onUpdateProfileCity(detectedCity, coords);

          await buildRoute(coords, detectedCity, `Position GPS détectée : ${detectedCity}`);
        },
        (err) => {
          showNotice('Impossible d\'obtenir la position GPS (autorisation requise).');
        }
      );
    }
  };

  const handleSearchCity = async (q: string) => {
    setCityInput(q);
    if (q.length > 2) {
      setIsSearching(true);
      const results = await searchLocation(q);
      setSearchResults(results);
      setIsSearching(false);
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectCityResult = (res: LocationSearchResult) => {
    const coords = { lat: res.lat, lng: res.lng };
    const name = res.city || res.displayName.split(',')[0];
    setCityInput(name);
    setCurrentCoords(coords);
    setSearchResults([]);
    if (onUpdateProfileCity) onUpdateProfileCity(name, coords);

    buildRoute(coords, name, `Localisation définie sur ${name}`);
  };

  const handleSaveRoute = () => {
    saveCustomRoute(currentRoute);
    setSavedRoutesList(getSavedRoutes());
    setIsSaved(true);
    showNotice('Parcours enregistré dans vos favoris !');
  };

  const handleDeleteSavedRoute = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomRoute(id);
    setSavedRoutesList(getSavedRoutes());
    showNotice('Parcours supprimé des favoris.');
  };

  const handleDownloadGpx = () => {
    downloadGpxFile(currentRoute);
    showNotice('Fichier GPX téléchargé (compatible Garmin/Wahoo/Strava).');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        try {
          const parsed = parseGpxString(content, file.name);
          setCurrentRoute(parsed);
          saveCustomRoute(parsed);
          setSavedRoutesList(getSavedRoutes());
          showNotice(`Parcours GPX importé : ${parsed.name} (${parsed.estimatedDistanceKm} km)`);
        } catch {
          showNotice('Erreur lors de la lecture du fichier GPX.');
        }
      }
    };
    reader.readAsText(file);
  };

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Elevation Profile calculation for SVG
  const waypoints = currentRoute.waypoints || [];
  const maxElev = Math.max(...waypoints.map((w) => w.elevationM), 100);
  const minElev = Math.min(...waypoints.map((w) => w.elevationM), 0);
  const elevRange = Math.max(maxElev - minElev, 40);
  const totalDist = currentRoute.estimatedDistanceKm || 30;

  const svgWidth = 650;
  const svgHeight = 120;
  const pad = 15;

  const points = waypoints.map((w, idx) => {
    const x = pad + (w.distanceFromStartKm / totalDist) * (svgWidth - pad * 2);
    const y = svgHeight - pad - ((w.elevationM - minElev) / elevRange) * (svgHeight - pad * 2);
    return { x, y, ...w, idx };
  });

  const pathD =
    points.length > 0
      ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')
      : '';
  const areaD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - pad} L ${points[0].x} ${svgHeight - pad} Z`
      : '';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-amber-500 text-stone-950 font-bold px-4 py-2.5 rounded-2xl shadow-2xl text-xs flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Screen Title & Real Road Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400">
              <Compass className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Itinéraires & Cartes
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
              GPS / OpenStreetMap
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Générez des boucles autour de chez vous sur le réseau routier OpenStreetMap, importez vos traces GPX et calibrez votre allure.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".gpx"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-xs font-semibold text-stone-200 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Importer GPX</span>
          </button>

          <button
            onClick={handleDownloadGpx}
            className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-xs font-semibold text-stone-200 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Exporter GPX</span>
          </button>

          <button
            onClick={handleSaveRoute}
            disabled={isSaved}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              isSaved
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                : 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-200'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span>{isSaved ? 'Enregistré' : 'Sauvegarder'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Generator Controls + Live Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Generator Controls & Saved Routes */}
        <div className="lg:col-span-5 space-y-4">
          {/* Real Route Customizer Card */}
          <div className="p-5 rounded-3xl bg-stone-900 border border-stone-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Générateur de boucle locale
              </span>
              <button
                type="button"
                onClick={handleDetectGps}
                className="text-[11px] text-amber-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3 h-3" />
                <span>Ma position GPS</span>
              </button>
            </div>

            {/* City search input */}
            <div className="relative">
              <label className="block text-[11px] text-stone-400 font-semibold mb-1">
                Point de départ (Ville, Commune, Région)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={cityInput}
                  onChange={(e) => handleSearchCity(e.target.value)}
                  placeholder="Ex: Namur, Annecy, Nice, Lyon, Bordeaux, Liège..."
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-white text-xs font-semibold focus:border-amber-500 focus:outline-none"
                />
                <Search className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-3" />
              </div>

              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-stone-950 border border-stone-700 rounded-xl overflow-hidden shadow-2xl z-30 max-h-48 overflow-y-auto">
                  {searchResults.map((res, i) => (
                    <div
                      key={i}
                      onClick={() => handleSelectCityResult(res)}
                      className="p-2.5 hover:bg-stone-800 cursor-pointer text-stone-200 border-b border-stone-850 last:border-0"
                    >
                      <div className="font-bold text-white text-xs">{res.city}</div>
                      <div className="text-[10px] text-stone-400 truncate">{res.displayName}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Distance Slider */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-300 font-semibold">Distance souhaitée</span>
                <span className="font-mono text-amber-400 font-black text-sm">{distanceKm} km</span>
              </div>
              <input
                type="range"
                min="15"
                max="130"
                step="5"
                value={distanceKm}
                onChange={(e) => setDistanceKm(parseInt(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-stone-500 font-mono">
                <span>15 km (Court)</span>
                <span>50 km</span>
                <span>130 km (Sortie longue)</span>
              </div>
            </div>

            {/* Terrain Profile */}
            <div className="space-y-1.5 text-xs">
              <label className="block text-stone-300 font-semibold">Relief & Dénivelé</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'plat', label: 'Plat', desc: 'Roulant / CLM' },
                  { id: 'vallonne', label: 'Vallonné', desc: 'Bosses & Puncheur' },
                  { id: 'montagne', label: 'Montagne', desc: 'Cols & D+' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTerrain(t.id as any)}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      terrain === t.id
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <div className="text-[11px]">{t.label}</div>
                    <div className="text-[9px] opacity-75">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Bike Type */}
            <div className="space-y-1.5 text-xs">
              <label className="block text-stone-300 font-semibold">Type de parcours</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'route', label: 'Route (100% Asphalte)' },
                  { id: 'gravel', label: 'Gravel (Asphalte & Pistes)' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBikeType(b.id as any)}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      bikeType === b.id
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <div className="text-[11px]">{b.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateNewRoute}
              className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Générer la boucle sur routes réelles</span>
            </button>
          </div>

          {/* Saved Routes Library */}
          <div className="p-4 rounded-3xl bg-stone-900 border border-stone-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-amber-400" />
              Parcours favoris & traces ({savedRoutesList.length})
            </h3>

            {savedRoutesList.length === 0 ? (
              <p className="text-xs text-stone-500 italic py-2">
                Aucun parcours favori enregistré pour le moment.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {savedRoutesList.map((r) => {
                  const isCurrent = currentRoute.id === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => {
                        setCurrentRoute(r);
                        setIsSaved(true);
                      }}
                      className={`p-3 rounded-2xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                        isCurrent
                          ? 'bg-amber-500/10 border-amber-500 text-white ring-1 ring-amber-500'
                          : 'bg-stone-950 border-stone-800 hover:border-stone-700 text-stone-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-bold text-white truncate">{r.name}</div>
                        <div className="text-[10px] text-stone-400 mt-0.5 flex items-center gap-2">
                          <span className="text-amber-400 font-mono font-bold">
                            {r.estimatedDistanceKm.toFixed(1)} km
                          </span>
                          <span>•</span>
                          <span className="text-cyan-400 font-mono font-bold">+{r.totalAscentM}m D+</span>
                          <span>•</span>
                          <span className="capitalize">{r.terrainType}</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteSavedRoute(r.id, e)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-stone-850 cursor-pointer"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (7 cols): Leaflet OpenStreetMap & Elevation Profile */}
        <div className="lg:col-span-7 space-y-4">
          {/* Active Route Summary Bar & Launch Button */}
          <div className="p-4 rounded-3xl bg-stone-900 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                  Parcours Sélectionné
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-stone-950 text-stone-300 font-mono">
                  {currentRoute.surface === 'mixte_gravel' ? 'Gravel' : '100% Asphalte'}
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">{currentRoute.name}</h3>
            </div>

            <button
              onClick={() => onSelectRouteForRide(currentRoute, activePlan)}
              className="py-3 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-amber-500/20 shrink-0"
            >
              <Play className="w-4 h-4 fill-stone-950" />
              <span>Rouler sur ce parcours</span>
            </button>
          </div>

          {/* Interactive Leaflet Map Container */}
          <div className="rounded-3xl bg-stone-950 border border-stone-800 overflow-hidden shadow-2xl relative h-72 sm:h-96">
            <div ref={mapContainerRef} className="w-full h-full z-10" />

            {/* Map Overlay Badge */}
            <div className="absolute top-3 right-3 z-20 bg-stone-950/85 backdrop-blur-sm border border-stone-800 rounded-xl px-3 py-1.5 text-[11px] font-mono text-stone-300 flex items-center gap-2">
              <span className="text-amber-400 font-bold">{currentRoute.estimatedDistanceKm.toFixed(1)} km</span>
              {/* Le dénivelé n'est affiché que s'il vient d'un modèle altimétrique
                  réel. Afficher un chiffre inventé serait pire que ne rien dire. */}
              {currentRoute.elevationSource === 'measured' && (
                <>
                  <span>•</span>
                  <span className="text-cyan-400 font-bold">+{currentRoute.totalAscentM} m D+</span>
                </>
              )}
            </div>

            {/* Provenance du tracé : la distinction est décisive avant de partir
                rouler sur un itinéraire qu'on ne connaît pas. */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
              {isRouting ? (
                <span className="px-2.5 py-1 rounded-lg bg-stone-950/85 backdrop-blur-sm border border-stone-800 text-[10.5px] font-bold text-amber-300">
                  Calcul de l'itinéraire…
                </span>
              ) : currentRoute.routeSource === 'estimation' ? (
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 backdrop-blur-sm border border-amber-500/40 text-[10.5px] font-bold text-amber-300">
                  Tracé approximatif
                </span>
              ) : currentRoute.routeSource === 'roads' ? (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/40 text-[10.5px] font-bold text-emerald-300">
                  Routes réelles
                </span>
              ) : null}
            </div>
          </div>

          {/* Dynamic Elevation Chart */}
          {points.length > 1 && (
            <div className="p-4 rounded-3xl bg-stone-900 border border-stone-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span className="font-bold text-stone-300 flex items-center gap-1.5">
                  <Mountain className="w-3.5 h-3.5 text-amber-400" />
                  Profil Altimétrique & Secteurs d'effort
                </span>
                <span className="font-mono text-[11px] text-stone-500">
                  Min: {minElev}m | Max: {maxElev}m
                </span>
              </div>

              <div className="w-full bg-stone-950 rounded-2xl p-2 border border-stone-850 overflow-hidden">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-24 sm:h-28">
                  <defs>
                    <linearGradient id="elevGradMap" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  <line x1={pad} y1={pad} x2={svgWidth - pad} y2={pad} stroke="#292524" strokeDasharray="3 3" />
                  <line x1={pad} y1={svgHeight / 2} x2={svgWidth - pad} y2={svgHeight / 2} stroke="#292524" strokeDasharray="3 3" />
                  <line x1={pad} y1={svgHeight - pad} x2={svgWidth - pad} y2={svgHeight - pad} stroke="#44403c" />

                  <path d={areaD} fill="url(#elevGradMap)" />
                  <path d={pathD} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />

                  {points.map((p, idx) => {
                    const isSel = activeWpIdx === idx;
                    return (
                      <g key={idx} className="cursor-pointer" onClick={() => setActiveWpIdx(idx)}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={isSel ? 6 : 4}
                          fill={isSel ? '#ffffff' : '#f59e0b'}
                          stroke="#0c0a09"
                          strokeWidth="2"
                        />
                        <text
                          x={p.x}
                          y={p.y - 8}
                          fontSize="9"
                          fill={isSel ? '#fbbf24' : '#a8a29e'}
                          textAnchor="middle"
                          fontWeight={isSel ? 'bold' : 'normal'}
                        >
                          {p.elevationM}m
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}

          {/* Waypoints & Pacing Guidance Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Guidage & Gestion des intervalles par secteur
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {waypoints.map((wp, idx) => {
                const isSelected = activeWpIdx === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => setActiveWpIdx(idx)}
                    className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-stone-850 border-amber-500 text-white shadow-md'
                        : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold mb-1">
                      <span className="flex items-center gap-1.5 text-stone-200">
                        <span className="w-4 h-4 rounded-full bg-stone-800 text-[10px] flex items-center justify-center font-bold text-amber-400">
                          {idx + 1}
                        </span>
                        <span className="truncate">{wp.name}</span>
                      </span>
                      <span className="font-mono text-stone-500 text-[11px] shrink-0">
                        km {wp.distanceFromStartKm.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-300 leading-snug">{wp.instruction}</p>
                    {wp.pacingAdvice && (
                      <p className="text-[10px] text-amber-400 font-medium mt-1">
                        ⚡ {wp.pacingAdvice}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
