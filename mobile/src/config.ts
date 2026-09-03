import { Platform } from 'react-native';

/** Geliştirme: Android emülatörü ana makineye 10.0.2.2 ile ulaşır. Üretimde HTTPS zorunlu. */
export const API_BASE_URL = __DEV__
  ? Platform.select({ android: 'http://10.0.2.2:3000', default: 'http://localhost:3000' })!
  : 'https://api.[ALANADI]';

export const QUICK_TEMPLATES = ['Dönerken ekmek al', 'Beni ara', 'Eve gelirken haber ver', 'Süt bitti', 'Çöpü atar mısın?'];
