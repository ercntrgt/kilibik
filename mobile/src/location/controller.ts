import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';
import type { LocationPlain } from '../../../shared/src/types';
import { ApiError, api } from '../api/client';
import { encryptLocation } from '../crypto/envelope';
import { roundCoord, shouldUpload, type Fix } from '../logic/locationPolicy';
import type { LocationPermission } from '../logic/permissions';

/**
 * Konum denetleyicisi.
 * - Konum geçmişi tutmaz: yalnızca son yüklenen fix bellekte (kalıcı depolama yok).
 * - 150 m hareket + en fazla 2 dakikada bir; sürekli akış yok.
 * - Sunucu "sharing_disabled" derse kendini durdurur.
 * - İzin yoksa hiçbir şey yapmaz; uygulamanın geri kalanı etkilenmez.
 */
export class LocationController {
  private watchId: number | null = null;
  private lastUploaded: Fix | null = null;
  private lastFix: Fix | null = null;
  private key: Uint8Array | null = null;
  onStatus: (s: 'idle' | 'running' | 'stopped_by_server' | 'no_permission' | 'error') => void = () => {};

  async requestPermission(background: boolean): Promise<LocationPermission> {
    if (Platform.OS === 'android') {
      const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      if (fine !== PermissionsAndroid.RESULTS.GRANTED) return fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied';
      if (!background) return 'whenInUse';
      // Android 10+: arka plan izni ayrı istenir; reddedilirse yalnızca ön planda paylaşılır.
      const bg = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
      return bg === PermissionsAndroid.RESULTS.GRANTED ? 'always' : 'whenInUse';
    }
    return new Promise<LocationPermission>((resolve) => {
      Geolocation.requestAuthorization(
        () => resolve(background ? 'always' : 'whenInUse'),
        (err) => resolve(err.PERMISSION_DENIED ? 'denied' : 'unknown'),
      );
    });
  }

  start(sharedKey: Uint8Array) {
    this.key = sharedKey;
    if (this.watchId !== null) return;
    this.watchId = Geolocation.watchPosition(
      (pos) => void this.onFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, at: pos.timestamp }, pos.coords.accuracy),
      () => this.onStatus('error'),
      {
        enableHighAccuracy: false,
        distanceFilter: 100, // metre — OS seviyesinde ilk eleme; asıl karar shouldUpload()
        interval: 60_000,
        fastestInterval: 30_000,
        useSignificantChanges: false,
      },
    );
    this.onStatus('running');
  }

  stop() {
    if (this.watchId !== null) Geolocation.clearWatch(this.watchId);
    this.watchId = null;
    this.lastUploaded = null;
    this.lastFix = null;
    this.key = null;
    this.onStatus('idle');
  }

  /** Son bilinen fix (yalnızca bellek; haritada "sen" işareti için). */
  get current(): Fix | null {
    return this.lastFix;
  }

  private async onFix(fix: Fix, accuracy: number | null) {
    this.lastFix = fix;
    if (!this.key) return;
    const decision = shouldUpload(this.lastUploaded, fix, Date.now());
    if (!decision.upload) return;
    const plain: LocationPlain = { lat: roundCoord(fix.lat), lng: roundCoord(fix.lng), acc: accuracy == null ? null : Math.round(accuracy), at: fix.at };
    try {
      await api('PUT', '/location', { blob: encryptLocation(this.key, plain) });
      this.lastUploaded = { ...fix, at: Date.now() };
    } catch (e) {
      if (e instanceof ApiError && e.code === 'sharing_disabled') {
        this.stop();
        this.onStatus('stopped_by_server');
      } else if (e instanceof ApiError && e.code === 'location_rate_limited') {
        // Sunucu üst sınırı; bir sonraki fix'te tekrar denenir.
      }
    }
  }
}

export const locationController = new LocationController();
