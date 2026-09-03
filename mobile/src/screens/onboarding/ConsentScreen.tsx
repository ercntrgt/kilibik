import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { CONSENT_DEFAULT_CHECKED } from '../../logic/consent';
import { Body, Button, Checkbox, Screen, Title } from '../../components/ui';
import { t } from '../../i18n/tr';
import type { AuthStackParams } from '../../navigation/types';
import { LegalDocView } from '../LegalDocScreen';

/**
 * Konum için AYRI açık rıza ekranı. Kutu önceden işaretli DEĞİLDİR.
 * Rıza vermeden devam edilebilir; konum paylaşımı kapalı kalır.
 */
export function ConsentScreen({ navigation, route }: NativeStackScreenProps<AuthStackParams, 'Consent'>) {
  const [consent, setConsent] = useState<boolean>(CONSENT_DEFAULT_CHECKED);
  const next = (locationConsent: boolean) => navigation.navigate('Phone', { birthDate: route.params.birthDate, locationConsent });
  return (
    <Screen>
      <Title>{t.consentTitle}</Title>
      <Body>{t.consentBody}</Body>
      <LegalDocView slug="location-consent" compact />
      <Checkbox testID="location-consent" checked={consent} onChange={setConsent} label={t.consentCheckbox} />
      <Body muted>{t.consentNote}</Body>
      <Button title={t.continue} disabled={!consent} onPress={() => next(true)} />
      <Button title={t.consentSkip} variant="secondary" onPress={() => next(false)} />
    </Screen>
  );
}
