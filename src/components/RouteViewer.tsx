import React, { useState } from 'react';
import { CyclingRoute } from '../types';
import {
  Navigation,
  Mountain,
  TrendingUp,
  ShieldAlert,
  Compass,
  MapPin,
  CheckCircle,
  Download,
  Flame,
  Bike,
  Route as RouteIcon,
} from 'lucide-react';

interface RouteViewerProps {
  route: CyclingRoute;
  onSelectRouteForWorkout?: () => void;
  compact?: boolean;
}

export const RouteViewer: React.FC<RouteViewerProps> = ({
  route,
  onSelectRouteForWorkout,
  compact = false,
}) => {
  const [activeWaypointIdx, setActiveWaypointIdx] = useState<number>(0);

  // Generate SVG elevation profile
  const waypoints = route.waypoints || [];
  const maxElev = Math.max(...waypoints.map((w) => w.elevationM), 100);
  const minElev = Math.min(...waypoints.map((w) => w.elevationM), 0);
  const elevRange = Math.max(maxElev - minElev, 50);

  const totalDist = route.estimatedDistanceKm || 30;

  // Build SVG points
  const svgWidth = 600;
  const svgHeight = 140;
  const padding = 20;

  const points = waypoints.map((w, idx) => {
    const x = padding + (w.distanceFromStartKm / totalDist) * (svgWidth - padding * 2);
    const y = svgHeight - padding - ((w.elevationM - minElev) / elevRange) * (svgHeight - padding * 2);
    return { x, y, ...w, idx };
  });

  const pathD = points.length > 0
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')
    : '';

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - padding} L ${points[0].x} ${svgHeight - padding} Z`
    : '';

  return (
    <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-4 shadow-xl">
      {/* Route Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <RouteIcon className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-white">{route.name}</h3>
          </div>
          <p className="text-xs text-stone-400 mt-1">{route.description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-center">
            <div className="text-[10px] text-stone-500 font-bold uppercase">Distance</div>
            <div className="font-mono font-black text-amber-400 text-sm">
              {route.estimatedDistanceKm.toFixed(1)} km
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-center">
            <div className="text-[10px] text-stone-500 font-bold uppercase">Dénivelé +</div>
            <div className="font-mono font-black text-cyan-400 text-sm">
              +{route.totalAscentM} m
            </div>
          </div>
        </div>
      </div>

      {/* Why this route fits the intervals */}
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 flex items-start gap-2.5">
        <Bike className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-amber-300 font-semibold">Adéquation avec la séance : </strong>
          {route.idealForWorkout}
        </div>
      </div>

      {/* Dynamic Elevation Chart SVG */}
      {points.length > 1 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-stone-400">
            <span className="flex items-center gap-1 font-semibold text-stone-300">
              <Mountain className="w-3.5 h-3.5 text-amber-400" />
              Profil Altimétrique & Secteurs d'effort
            </span>
            <span className="font-mono text-stone-500">Min: {minElev}m | Max: {maxElev}m</span>
          </div>

          <div className="w-full bg-stone-950 rounded-xl p-2 border border-stone-800 overflow-hidden relative">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-28 sm:h-36">
              <defs>
                <linearGradient id="elevGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1={padding} y1={padding} x2={svgWidth - padding} y2={padding} stroke="#292524" strokeDasharray="3 3" />
              <line x1={padding} y1={svgHeight / 2} x2={svgWidth - padding} y2={svgHeight / 2} stroke="#292524" strokeDasharray="3 3" />
              <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#44403c" />

              {/* Area & Stroke */}
              <path d={areaD} fill="url(#elevGrad)" />
              <path d={pathD} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />

              {/* Waypoint markers */}
              {points.map((p, idx) => {
                const isActive = activeWaypointIdx === idx;
                return (
                  <g key={idx} className="cursor-pointer" onClick={() => setActiveWaypointIdx(idx)}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isActive ? 6 : 4}
                      fill={isActive ? '#ffffff' : '#f59e0b'}
                      stroke="#0c0a09"
                      strokeWidth="2"
                    />
                    <text
                      x={p.x}
                      y={p.y - 8}
                      fontSize="9"
                      fill={isActive ? '#fbbf24' : '#a8a29e'}
                      textAnchor="middle"
                      fontWeight={isActive ? 'bold' : 'normal'}
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

      {/* Interactive Waypoints Breakdown */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
          Points de repère & Gestion de l'allure (Pacing)
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
          {waypoints.map((wp, idx) => {
            const isSelected = activeWaypointIdx === idx;
            return (
              <div
                key={idx}
                onClick={() => setActiveWaypointIdx(idx)}
                className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-stone-850 border-amber-500/80 text-white shadow-md'
                    : 'bg-stone-950 border-stone-800/80 text-stone-400 hover:border-stone-700'
                }`}
              >
                <div className="flex items-center justify-between font-semibold mb-1">
                  <span className="flex items-center gap-1.5 text-stone-200">
                    <span className="w-4 h-4 rounded-full bg-stone-800 text-[10px] flex items-center justify-center font-bold text-amber-400">
                      {idx + 1}
                    </span>
                    {wp.name}
                  </span>
                  <span className="font-mono text-stone-500 text-[11px]">
                    km {wp.distanceFromStartKm.toFixed(1)} ({wp.elevationM}m)
                  </span>
                </div>

                <p className="text-[11px] text-stone-300">{wp.instruction}</p>
                {wp.pacingAdvice && (
                  <p className="text-[10px] text-amber-400/90 font-medium mt-1">
                    ⚡ {wp.pacingAdvice}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pacing Strategy & Safety Tips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
        <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
          <div className="font-bold text-stone-300 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            Stratégie d'allure globale
          </div>
          <p className="text-stone-400 text-[11px] leading-relaxed">
            {route.pacingStrategy}
          </p>
        </div>

        {route.safetyTips && route.safetyTips.length > 0 && (
          <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
            <div className="font-bold text-rose-300 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              Sécurité & Circulation
            </div>
            <ul className="text-stone-400 text-[11px] space-y-0.5 list-disc list-inside">
              {route.safetyTips.map((tip, tIdx) => (
                <li key={tIdx}>{tip}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
