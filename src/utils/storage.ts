import { RideRecord } from '../types';

const DB_NAME = 'cyclocoach_db';
const DB_VERSION = 1;
const STORE_NAME = 'rides';
const LOCAL_STORAGE_KEY = 'cyclocoach_rides_backup';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB non supporté'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
    };
  });
}

export async function saveRideRecord(ride: RideRecord): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(ride);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Fallback vers localStorage pour la sauvegarde:', err);
    try {
      const existing = getLocalStorageRides();
      const filtered = existing.filter(r => r.id !== ride.id);
      filtered.unshift(ride);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    } catch (lsErr) {
      console.error('Erreur écriture localStorage:', lsErr);
    }
  }
}

export async function getAllRideRecords(): Promise<RideRecord[]> {
  try {
    const db = await openDB();
    return await new Promise<RideRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (req.result as RideRecord[]) || [];
        // Sort descending by date
        records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        resolve(records);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Fallback vers localStorage pour la lecture:', err);
    return getLocalStorageRides();
  }
}

export async function deleteRideRecord(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Fallback vers localStorage pour suppression:', err);
  }

  // Also remove from localStorage if present
  try {
    const existing = getLocalStorageRides().filter(r => r.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    // Ignore
  }
}

function getLocalStorageRides(): RideRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const rides: RideRecord[] = JSON.parse(raw);
    rides.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return rides;
  } catch (e) {
    return [];
  }
}

/**
 * Export a ride to GPX format for cycling apps (Strava, Garmin, etc.)
 */
export function exportRideToGPX(ride: RideRecord): string {
  const points = ride.gpsTrack || [];
  const startTime = new Date(ride.date).toISOString();

  let trkpts = '';
  points.forEach((pt) => {
    const ptTime = new Date(pt.speed ? Date.now() : ride.date).toISOString();
    trkpts += `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lng.toFixed(6)}">
        <time>${ptTime}</time>
        <extensions>
          <speed>${(pt.speed / 3.6).toFixed(2)}</speed>
        </extensions>
      </trkpt>\n`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CycloCoach" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${ride.planName} - CycloCoach</name>
    <time>${startTime}</time>
  </metadata>
  <trk>
    <name>${ride.planName}</name>
    <desc>${ride.planGoal}</desc>
    <trkseg>
${trkpts}    </trkseg>
  </trk>
</gpx>`;
}
