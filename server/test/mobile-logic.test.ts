/**
 * Mobil uygulamanın saf mantık modülleri (mobile/src/logic) burada, gerçek
 * cihaz gerektirmeden test edilir.
 */
import { describe, expect, it } from 'vitest';
import { CONSENT_DEFAULT_CHECKED, canContinue, canEnableLocation, initialConsentState } from '../../mobile/src/logic/consent';
import { TAPS_TO_DELETE, nextStep, type DeleteStep } from '../../mobile/src/logic/deleteFlow';
import { KEEPALIVE_MS, distanceMeters, shouldUpload } from '../../mobile/src/logic/locationPolicy';
import { capabilitiesFor, effectiveSharing } from '../../mobile/src/logic/permissions';

describe('consent (onboarding)', () => {
  it('checkboxes are never pre-checked and location consent is separate', () => {
    expect(CONSENT_DEFAULT_CHECKED).toBe(false);
    expect(initialConsentState).toEqual({ privacyNoticeRead: false, locationConsent: false });
    expect(canContinue({ privacyNoticeRead: true, locationConsent: false })).toBe(true);
    expect(canEnableLocation({ privacyNoticeRead: true, locationConsent: false })).toBe(false);
    expect(canEnableLocation({ privacyNoticeRead: true, locationConsent: true })).toBe(true);
  });
});

describe('location upload policy', () => {
  const t0 = 1_000_000;
  const home = { lat: 41.0, lng: 29.0, at: t0 };
  it('first fix uploads; then 150 m + 2 min rule; no continuous stream', () => {
    expect(shouldUpload(null, home).upload).toBe(true);
    // 1 dk sonra 1 km hareket: çok erken
    expect(shouldUpload(home, { lat: 41.01, lng: 29.0, at: t0 + 60_000 })).toEqual({ upload: false, reason: 'too_soon' });
    // 2 dk sonra 50 m: hareket eşiği altında
    expect(shouldUpload(home, { lat: 41.0004, lng: 29.0, at: t0 + 120_000 })).toEqual({ upload: false, reason: 'not_moved' });
    // 2 dk sonra 200 m: gönder
    expect(shouldUpload(home, { lat: 41.0018, lng: 29.0, at: t0 + 120_000 })).toEqual({ upload: true, reason: 'moved' });
    // Sabit ama keepalive doldu (TTL dolmasın)
    expect(shouldUpload(home, { ...home, at: t0 + KEEPALIVE_MS })).toEqual({ upload: true, reason: 'keepalive' });
    expect(KEEPALIVE_MS).toBeGreaterThanOrEqual(120_000);
    expect(KEEPALIVE_MS).toBeLessThan(300_000);
  });
  it('haversine sanity', () => {
    expect(Math.round(distanceMeters({ lat: 41, lng: 29, at: 0 }, { lat: 41.001, lng: 29, at: 0 }))).toBe(111);
  });
});

describe('permissions: app works without background location', () => {
  it.each(['denied', 'blocked', 'unknown', 'whenInUse', 'always'] as const)('%s keeps requests, nudge, map, partner view', (p) => {
    const c = capabilitiesFor(p);
    expect(c.requests && c.nudge && c.map && c.canSeePartner).toBe(true);
  });
  it('maps permission to own sharing mode', () => {
    expect(capabilitiesFor('always').ownSharing).toBe('background');
    expect(capabilitiesFor('whenInUse').ownSharing).toBe('foreground_only');
    expect(capabilitiesFor('denied').ownSharing).toBe('unavailable');
    expect(effectiveSharing(true, 'denied')).toBe(false);
    expect(effectiveSharing(true, 'whenInUse')).toBe(true);
  });
});

describe('account deletion reachable in 3 taps', () => {
  it('home → settings → delete → confirm', () => {
    let s: DeleteStep = 'home';
    for (const tap of TAPS_TO_DELETE) s = nextStep(s, tap);
    expect(TAPS_TO_DELETE).toHaveLength(3);
    expect(s).toBe('deleting');
    expect(nextStep('confirm', 'cancel')).toBe('settings');
  });
});
