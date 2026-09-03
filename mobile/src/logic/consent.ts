/**
 * Onboarding rıza mantığı (saf TS, test edilebilir).
 * - Aydınlatma metni "okudum" ve konum için AYRI açık rıza.
 * - Kutular ASLA önceden işaretli gelmez.
 * - Konum rızası olmadan uygulamaya devam edilebilir (konum paylaşımı kapalı kalır).
 */
export const CONSENT_DEFAULT_CHECKED = false;

export interface ConsentState {
  privacyNoticeRead: boolean; // aydınlatma metnini gördü/okudu
  locationConsent: boolean; // açık rıza — ayrı kutu
}

export const initialConsentState: ConsentState = {
  privacyNoticeRead: CONSENT_DEFAULT_CHECKED,
  locationConsent: CONSENT_DEFAULT_CHECKED,
};

/** Devam etmek için yalnızca aydınlatma metninin okunmuş olması gerekir. */
export function canContinue(s: ConsentState): boolean {
  return s.privacyNoticeRead;
}

/** Konum paylaşımının açılabilmesi için açık rıza şarttır. */
export function canEnableLocation(s: ConsentState): boolean {
  return s.privacyNoticeRead && s.locationConsent;
}
