import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { MIN_AGE_YEARS } from '../../../../shared/src/constants';
import { Body, Button, ErrorText, Field, Screen, Title } from '../../components/ui';
import { t } from '../../i18n/tr';
import type { AuthStackParams } from '../../navigation/types';

/** Cihazda ön kontrol; kesin kontrol sunucuda. Doğum tarihi hiçbir yerde saklanmaz. */
export function isAdultLocal(birthDate: string, now = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return false;
  const bd = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (Number.isNaN(bd.getTime())) return false;
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - MIN_AGE_YEARS, now.getUTCMonth(), now.getUTCDate()));
  return bd.getTime() <= cutoff.getTime();
}

export function AgeScreen({ navigation }: NativeStackScreenProps<AuthStackParams, 'Age'>) {
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen>
      <Title>{t.ageTitle}</Title>
      <Body>{t.ageBody}</Body>
      <Field label={t.ageLabel} value={birthDate} onChangeText={setBirthDate} placeholder="1990-05-15" keyboardType="numbers-and-punctuation" autoFocus />
      <ErrorText>{error}</ErrorText>
      <Button
        title={t.continue}
        disabled={birthDate.length !== 10}
        onPress={() => {
          if (!isAdultLocal(birthDate)) return setError(t.ageTooYoung);
          setError(null);
          navigation.navigate('PrivacyNotice', { birthDate });
        }}
      />
    </Screen>
  );
}
