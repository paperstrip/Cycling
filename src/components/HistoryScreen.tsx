import React, { useState, useEffect } from 'react';
import { RideRecord } from '../types';
import { getAllRideRecords, deleteRideRecord, exportRideToGPX } from '../utils/storage';
import { formatTimeHoursDisplay, formatTimeDisplay } from '../utils/planFlatten';
import {
  History as HistoryIcon,
  ArrowLeft,
  Trash2,
  Download,
  Calendar,
  Navigation,
  Clock,
  Gauge,
  Zap,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface HistoryScreenProps {
  onBack: () => void;
  onSelectRideToReRun?: (planName: string) => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onBack, onSelectRideToReRun }) => {
  const [rides, setRides] = useState<RideRecord[]>([]);
  const [expandedRideId, setExpandedRideId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadRides();
  }, []);

  const loadRides = async () => {
    setLoading(true);
    const data = await getAllRideRecords();
    setRides(data);
    setLoading(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Voulez-vous vraiment supprimer cette sortie de l\'historique ?')) {
      await deleteRideRecord(id);
      loadRides();
    }
  };

  const handleExport = (ride: RideRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const gpx = exportRideToGPX(ride);
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyclocoach-${new Date(ride.date).toISOString().slice(0, 10)}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-4">
        <button
          id="btn-history-back"
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-xs font-semibold text-stone-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-amber-400" />
          <span>Retour aux séances</span>
        </button>

        <h1 className="text-base font-bold text-white flex items-center gap-2">
          <HistoryIcon className="w-4 h-4 text-amber-400" />
          <span>Historique des sorties ({rides.length})</span>
        </h1>
      </div>

      {loading ? (
        <div className="p-12 text-center text-stone-500 text-sm">
          Chargement des sorties passées...
        </div>
      ) : rides.length === 0 ? (
        <div className="rounded-2xl bg-stone-900 border border-stone-800 p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-stone-800 text-stone-500 flex items-center justify-center mx-auto">
            <HistoryIcon className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white">Aucune sortie enregistrée pour l'instant</h2>
          <p className="text-xs text-stone-400 max-w-sm mx-auto">
            Lancez votre première séance avec le coach vocal et le suivi GPS pour retrouver vos analyses de performance ici.
          </p>
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
          >
            Choisir une séance
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rides.map((ride) => {
            const isExpanded = expandedRideId === ride.id;
            const dateStr = new Date(ride.date).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={ride.id}
                className="rounded-2xl bg-stone-900 border border-stone-800 overflow-hidden transition-all shadow-md hover:border-stone-700"
              >
                {/* Header Item */}
                <div
                  onClick={() => setExpandedRideId(isExpanded ? null : ride.id)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">{ride.planName}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-stone-800 text-stone-400">
                        {ride.steps.length} blocs
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-stone-400">
                      <Calendar className="w-3.5 h-3.5 text-amber-500" />
                      <span>{dateStr}</span>
                    </div>
                  </div>

                  {/* Summary Badges */}
                  <div className="flex items-center gap-3 sm:gap-5 text-xs">
                    <div className="text-center">
                      <div className="text-[10px] uppercase text-stone-500 font-bold">Distance</div>
                      <div className="font-mono font-black text-white text-sm sm:text-base">
                        {ride.totalDistanceKm.toFixed(1)} km
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-[10px] uppercase text-stone-500 font-bold">Durée</div>
                      <div className="font-mono font-black text-white text-sm sm:text-base">
                        {formatTimeHoursDisplay(ride.totalDurationSec)}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-[10px] uppercase text-stone-500 font-bold">Vitesse Moy.</div>
                      <div className="font-mono font-black text-amber-400 text-sm sm:text-base">
                        {ride.avgSpeedKmh.toFixed(1)} km/h
                      </div>
                    </div>

                    <div className="flex items-center gap-1 pl-2 border-l border-stone-800">
                      <button
                        onClick={(e) => handleExport(ride, e)}
                        title="Exporter GPX"
                        className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => handleDelete(ride.id, e)}
                        title="Supprimer"
                        className="p-2 rounded-lg bg-stone-800 hover:bg-rose-900/50 text-stone-400 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="p-2 text-stone-500">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 sm:p-6 bg-stone-950 border-t border-stone-800/80 space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                      <h4 className="font-bold text-stone-300 uppercase text-[11px]">Détail bloc par bloc</h4>
                      <span className="text-stone-500 text-[11px]">Vitesse Max : {ride.maxSpeedKmh.toFixed(1)} km/h</span>
                    </div>

                    <div className="space-y-2">
                      {ride.steps.map((step, sIdx) => {
                        const delta = step.actualDurationSec - step.plannedDurationSec;
                        return (
                          <div
                            key={sIdx}
                            className="p-2.5 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-4 h-4 rounded-full bg-stone-800 text-[10px] text-stone-400 flex items-center justify-center font-bold">
                                {sIdx + 1}
                              </span>
                              <span className="font-semibold text-white">{step.title}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 uppercase font-bold">
                                {step.targetIntensity}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 font-mono">
                              <span className="text-stone-400">
                                {formatTimeDisplay(step.actualDurationSec)} / {formatTimeDisplay(step.plannedDurationSec)}
                              </span>
                              <span className="font-bold text-amber-400">{step.avgSpeedKmh.toFixed(1)} km/h</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Coach Log */}
                    {ride.coachMessages && ride.coachMessages.length > 0 && (
                      <div className="pt-2">
                        <h5 className="font-bold text-amber-400 text-[11px] mb-1.5 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Consignes vocales enregistrées ({ride.coachMessages.length})
                        </h5>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {ride.coachMessages.map((msg, mIdx) => (
                            <div key={mIdx} className="text-[11px] text-stone-400 flex items-start gap-2">
                              <span className="font-mono text-amber-500 shrink-0">{formatTimeDisplay(msg.timeSec)}</span>
                              <span className="italic">"{msg.text}"</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
