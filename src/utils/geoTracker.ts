import { GPSPoint } from '../types';

export type GeoStatus = 'idle' | 'locating' | 'active' | 'denied' | 'unavailable' | 'simulated';

export interface GeoState {
  status: GeoStatus;
  errorMessage: string | null;
  currentSpeedKmh: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
  totalDistanceKm: number;
  accuracy: number | null;
  lastPoint: GPSPoint | null;
  trackPoints: GPSPoint[];
}

export class GeoTracker {
  private watchId: number | null = null;
  private onUpdateCallback: ((state: GeoState) => void) | null = null;
  private trackPoints: GPSPoint[] = [];
  private totalDistanceMeters: number = 0;
  private maxSpeedKmh: number = 0;
  private status: GeoStatus = 'idle';
  private errorMessage: string | null = null;
  private currentSpeedKmh: number = 0;
  private accuracy: number | null = null;

  // Simulator
  private isSimulating: boolean = false;
  private simIntervalId: any = null;
  private simLat: number = 48.8566;
  private simLng: number = 2.3522;

  constructor(onUpdate?: (state: GeoState) => void) {
    if (onUpdate) this.onUpdateCallback = onUpdate;
  }

  public setCallback(cb: (state: GeoState) => void) {
    this.onUpdateCallback = cb;
  }

  public start(enableSimulatorFallback: boolean = false) {
    this.stop();
    this.status = 'locating';
    this.errorMessage = null;
    this.notify();

    if (this.isSimulating) {
      this.startSimulation();
      return;
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      this.status = 'unavailable';
      this.errorMessage = 'La géolocalisation n\'est pas supportée par votre navigateur.';
      if (enableSimulatorFallback) {
        this.startSimulation();
      } else {
        this.notify();
      }
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.handlePosition(position);
      },
      (error) => {
        console.warn('Geolocation error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          this.status = 'denied';
          this.errorMessage = 'Accès GPS refusé. Veuillez autoriser la géolocalisation dans les réglages de votre navigateur.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          this.status = 'unavailable';
          this.errorMessage = 'Signal GPS introuvable. Assurez-vous d\'être à ciel ouvert.';
        } else {
          this.status = 'unavailable';
          this.errorMessage = 'Recherche du signal satellite en cours...';
        }

        if (enableSimulatorFallback && (error.code === error.PERMISSION_DENIED || error.code === error.POSITION_UNAVAILABLE)) {
          this.startSimulation();
        } else {
          this.notify();
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 12000,
      }
    );
  }

  public enableSimulator(enable: boolean) {
    this.isSimulating = enable;
    if (enable) {
      if (this.watchId !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
      this.startSimulation();
    } else {
      if (this.simIntervalId) {
        clearInterval(this.simIntervalId);
        this.simIntervalId = null;
      }
      this.start(false);
    }
  }

  public getIsSimulating(): boolean {
    return this.isSimulating;
  }

  private startSimulation() {
    if (this.simIntervalId) clearInterval(this.simIntervalId);
    this.status = 'simulated';
    this.errorMessage = null;
    this.accuracy = 5;

    let targetBaseSpeed = 30; // km/h

    this.simIntervalId = setInterval(() => {
      // Simulate slight speed oscillation + movement
      const jitter = (Math.random() - 0.5) * 3;
      const speed = Math.max(12, Math.min(55, targetBaseSpeed + jitter));

      // Advance lat/lng by approx speed in 1 sec
      // 30 km/h = 8.33 m/s ~= 0.000075 deg/s
      const deltaDeg = (speed / 3600 / 111) * (1 + (Math.random() - 0.5) * 0.1);
      this.simLat += deltaDeg * 0.8;
      this.simLng += deltaDeg * 0.6;

      const fakePos: GeolocationPosition = {
        coords: {
          latitude: this.simLat,
          longitude: this.simLng,
          accuracy: 4,
          altitude: 45 + Math.sin(Date.now() / 10000) * 10,
          altitudeAccuracy: null,
          heading: 45,
          speed: speed / 3.6, // m/s
          toJSON: () => ({}),
        } as GeolocationCoordinates,
        timestamp: Date.now(),
        toJSON: () => ({}),
      };

      this.handlePosition(fakePos);
    }, 1000);

    this.notify();
  }

  public setSimulatedTargetSpeed(targetSpeedKmh: number) {
    if (this.isSimulating) {
      // Allows live screen to adapt speed when entering effort vs recup
      this.currentSpeedKmh = targetSpeedKmh;
    }
  }

  private handlePosition(position: GeolocationPosition) {
    const { latitude, longitude, accuracy, speed: rawSpeed, altitude } = position.coords;
    const now = position.timestamp || Date.now();

    this.status = this.isSimulating ? 'simulated' : 'active';
    this.errorMessage = null;
    this.accuracy = accuracy;

    let speedKmh = 0;

    // If device provides native speed (m/s)
    if (rawSpeed !== null && rawSpeed !== undefined && rawSpeed >= 0) {
      speedKmh = rawSpeed * 3.6;
    }

    const prevPoint = this.trackPoints.length > 0 ? this.trackPoints[this.trackPoints.length - 1] : null;

    if (prevPoint) {
      const distDeltaM = calculateHaversineDistance(
        prevPoint.latitude,
        prevPoint.longitude,
        latitude,
        longitude
      );

      const timeDeltaSec = (now - prevPoint.timestamp) / 1000;

      // Filter out spurious GPS jumps (> 150 km/h or accuracy worse than 50m)
      if (accuracy <= 50 || this.isSimulating) {
        if (timeDeltaSec > 0.3) {
          const calcSpeed = (distDeltaM / timeDeltaSec) * 3.6;
          // If native speed was missing or 0 while distance moved
          if (speedKmh === 0 && calcSpeed > 1 && calcSpeed < 120) {
            speedKmh = calcSpeed;
          }
          if (distDeltaM > 1 && distDeltaM < 200) {
            this.totalDistanceMeters += distDeltaM;
          }
        }
      }
    }

    // Clamp speed to realistic cycling range
    speedKmh = Math.max(0, Math.min( speedKmh, 95));
    this.currentSpeedKmh = speedKmh;

    if (speedKmh > this.maxSpeedKmh) {
      this.maxSpeedKmh = speedKmh;
    }

    const newPoint: GPSPoint = {
      timestamp: now,
      latitude,
      longitude,
      speedKmh,
      accuracy,
      altitude,
    };

    this.trackPoints.push(newPoint);
    this.notify();
  }

  public stop() {
    if (this.watchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.simIntervalId) {
      clearInterval(this.simIntervalId);
      this.simIntervalId = null;
    }
    this.status = 'idle';
    this.notify();
  }

  public reset() {
    this.stop();
    this.trackPoints = [];
    this.totalDistanceMeters = 0;
    this.maxSpeedKmh = 0;
    this.currentSpeedKmh = 0;
    this.accuracy = null;
    this.errorMessage = null;
  }

  public getState(): GeoState {
    const totalDistKm = this.totalDistanceMeters / 1000;
    let avgSpeed = 0;
    if (this.trackPoints.length > 1) {
      const firstT = this.trackPoints[0].timestamp;
      const lastT = this.trackPoints[this.trackPoints.length - 1].timestamp;
      const elapsedHours = (lastT - firstT) / 3600000;
      if (elapsedHours > 0.001) {
        avgSpeed = totalDistKm / elapsedHours;
      }
    }

    return {
      status: this.status,
      errorMessage: this.errorMessage,
      currentSpeedKmh: this.currentSpeedKmh,
      averageSpeedKmh: avgSpeed,
      maxSpeedKmh: this.maxSpeedKmh,
      totalDistanceKm: totalDistKm,
      accuracy: this.accuracy,
      lastPoint: this.trackPoints.length > 0 ? this.trackPoints[this.trackPoints.length - 1] : null,
      trackPoints: this.trackPoints,
    };
  }

  private notify() {
    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.getState());
    }
  }
}

/**
 * Haversine formula to calculate distance in meters between two lat/lng points
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius of Earth in meters
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
