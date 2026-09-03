import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { CONSENT_DEFAULT_CHECKED } from '../../logic/consent';
import { Button, Checkbox, Screen, Title } from '../../components/ui';
import { t } from '../../i18n/tr';
import type { AuthStackParams } from '../../navigation/types';
import { LegalDocView } from '../LegalDocScreen';

/** Aydınlatma metni (KVKK m.10). Açık rıza ekranından AYRI. */
export function PrivacyNoticeScreen({ navigation, route }: NativeStackScreenProps<AuthStackParams, 'PrivacyNotice'>) {
  const [read, setRead] = useState<boolean>(CONSENT_DEFAULT_CHECKED);
  return (
    <Screen>
      <Title>{t.privacyTitle}</Title>
      <LegalDocView slug="privacy-notice" compact />
      <Checkbox testID="privacy-read" checked={read} onChange={setRead} label={t.privacyRead} />
      <Button title={t.continue} disabled={!read} onPress={() => navigation.navigate('Consent', { birthDate: route.params.birthDate })} />
    </Screen>
  );
}
