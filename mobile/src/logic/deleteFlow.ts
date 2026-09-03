/**
 * Hesap silme akışı: ana ekrandan 3 dokunuş.
 *   1) Ayarlar sekmesi  2) "Hesabı sil"  3) "Evet, sil"
 * Ek bir "emin misiniz" katmanı, şifre sorma vb. YOK.
 */
export type DeleteStep = 'home' | 'settings' | 'confirm' | 'deleting';

export function nextStep(step: DeleteStep, tap: 'settings_tab' | 'delete_account' | 'confirm' | 'cancel'): DeleteStep {
  switch (step) {
    case 'home':
      return tap === 'settings_tab' ? 'settings' : 'home';
    case 'settings':
      return tap === 'delete_account' ? 'confirm' : 'settings';
    case 'confirm':
      if (tap === 'confirm') return 'deleting';
      if (tap === 'cancel') return 'settings';
      return 'confirm';
    default:
      return step;
  }
}

export const TAPS_TO_DELETE = ['settings_tab', 'delete_account', 'confirm'] as const;
