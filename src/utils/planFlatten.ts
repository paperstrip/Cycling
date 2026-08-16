import { WorkoutPlan, WorkoutBlock, ExecutionStep, IntensityZone } from '../types';

function getIntensityLabel(target: IntensityZone): string {
  switch (target) {
    case 'facile':
      return 'Allure facile / Récup';
    case 'moyen':
      return 'Tempo / Z3';
    case 'seuil':
      return 'Au seuil / Z4';
    case 'a_fond':
      return 'À fond / PMA Max';
    default:
      return 'Effort';
  }
}

export function flattenWorkoutPlan(plan: WorkoutPlan): ExecutionStep[] {
  const steps: ExecutionStep[] = [];
  let stepIndex = 0;

  plan.blocs.forEach((bloc, bIdx) => {
    const reps = bloc.repetitions && bloc.repetitions > 1 ? bloc.repetitions : 1;

    if (reps > 1 && bloc.type === 'effort') {
      for (let r = 1; r <= reps; r++) {
        // Effort step
        const effortPrompt = bloc.consigne_vocale || `Effort numéro ${r} sur ${reps} ! ${bloc.cible === 'a_fond' ? 'À fond, donne tout pendant ' : 'Effort soutenu pendant '}${formatSecondsToMinutes(bloc.duree_sec)}.`;
        steps.push({
          stepIndex: stepIndex++,
          title: `Effort ${r}/${reps}`,
          type: 'effort',
          durationSec: bloc.duree_sec,
          targetIntensity: bloc.cible,
          vocalPrompt: effortPrompt,
          repetitionInfo: {
            current: r,
            total: reps,
          },
        });

        // Recovery step (unless it's after the last rep if followed by cooldown, but cycling standard includes recovery or cooldown)
        const recupDuration = bloc.recup_sec || 60;
        const recupCible = bloc.recup_cible || 'facile';
        
        // Add recup step
        const isLastRep = r === reps;
        const recupPrompt = isLastRep
          ? `Dernière répétition terminée ! Récupère pendant ${formatSecondsToMinutes(recupDuration)} avant la suite.`
          : `Récupération active numéro ${r} sur ${reps}. Tourne les jambes souplement pendant ${formatSecondsToMinutes(recupDuration)}.`;

        steps.push({
          stepIndex: stepIndex++,
          title: `Récupération ${r}/${reps}`,
          type: 'recup',
          durationSec: recupDuration,
          targetIntensity: recupCible,
          vocalPrompt: recupPrompt,
          repetitionInfo: {
            current: r,
            total: reps,
          },
        });
      }
    } else {
      // Single block
      let title = 'Bloc';
      let defaultPrompt = '';

      if (bloc.type === 'echauffement') {
        title = 'Échauffement';
        defaultPrompt = bloc.consigne_vocale || `Échauffement progressif pendant ${formatSecondsToMinutes(bloc.duree_sec)}. Tourne les jambes en souplesse.`;
      } else if (bloc.type === 'retour_calme') {
        title = 'Retour au calme';
        defaultPrompt = bloc.consigne_vocale || `Retour au calme pendant ${formatSecondsToMinutes(bloc.duree_sec)}. Fais redescendre le cardio.`;
      } else if (bloc.type === 'recup') {
        title = 'Récupération';
        defaultPrompt = bloc.consigne_vocale || `Récupération de ${formatSecondsToMinutes(bloc.duree_sec)}. Pédalage souple.`;
      } else {
        title = 'Effort continu';
        defaultPrompt = bloc.consigne_vocale || `C'est parti pour ${formatSecondsToMinutes(bloc.duree_sec)} d'effort ${getIntensityLabel(bloc.cible)}.`;
      }

      steps.push({
        stepIndex: stepIndex++,
        title,
        type: bloc.type,
        durationSec: bloc.duree_sec,
        targetIntensity: bloc.cible,
        vocalPrompt: defaultPrompt,
      });
    }
  });

  return steps;
}

export function formatSecondsToMinutes(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins === 0) return `${secs} secondes`;
  if (secs === 0) return `${mins} minute${mins > 1 ? 's' : ''}`;
  return `${mins} min ${secs}s`;
}

export function formatTimeDisplay(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatTimeHoursDisplay(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
