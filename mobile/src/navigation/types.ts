export type AuthStackParams = {
  Age: undefined;
  PrivacyNotice: { birthDate: string };
  Consent: { birthDate: string };
  Phone: { birthDate: string; locationConsent: boolean };
  Otp: { birthDate: string; locationConsent: boolean; phone: string };
};

export type MainTabParams = {
  Home: undefined;
  Map: undefined;
  Nudge: undefined;
  Settings: undefined;
};

export type RootStackParams = {
  Tabs: undefined;
  SendRequest: undefined;
  LegalDoc: { slug: 'privacy-notice' | 'location-consent' | 'privacy-policy' | 'retention'; title: string };
};
