import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyPair } from '../../../shared/src/crypto';
import { toBase64 } from '../../../shared/src/crypto';
import type { MeView, PairView } from '../../../shared/src/types';
import { ApiError, api, setAuthToken } from '../api/client';
import { clearToken, deleteKeyPair, loadOrCreateKeyPair, loadToken, saveToken, sharedKeyWith } from '../crypto/keys';

const ONBOARDED_KEY = 'kilibik.onboarded';

export interface SessionState {
  booting: boolean;
  token: string | null;
  userId: string | null;
  me: MeView | null;
  keyPair: KeyPair | null;
  /** Partnerle ortak anahtar; yalnızca bellekte, eşleşme varken. */
  sharedKey: Uint8Array | null;
  onboarded: boolean;
}

interface SessionActions {
  signIn(token: string, userId: string): Promise<void>;
  refreshMe(): Promise<MeView | null>;
  ensureKeys(): Promise<KeyPair>;
  adoptPair(pair: PairView | null): void;
  setOnboarded(v: boolean): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
}

const Ctx = createContext<(SessionState & SessionActions) | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({
    booting: true,
    token: null,
    userId: null,
    me: null,
    keyPair: null,
    sharedKey: null,
    onboarded: false,
  });
  const keyPairRef = useRef<KeyPair | null>(null);

  const ensureKeys = useCallback(async () => {
    if (keyPairRef.current) return keyPairRef.current;
    const kp = await loadOrCreateKeyPair();
    keyPairRef.current = kp;
    setState((s) => ({ ...s, keyPair: kp }));
    return kp;
  }, []);

  const adoptPair = useCallback((pair: PairView | null) => {
    const kp = keyPairRef.current;
    const sharedKey = pair?.partner_public_key && kp ? sharedKeyWith(kp, pair.partner_public_key) : null;
    setState((s) => ({ ...s, sharedKey, me: s.me ? { ...s.me, pair } : s.me }));
  }, []);

  const refreshMe = useCallback(async (): Promise<MeView | null> => {
    try {
      const me = await api<MeView>('GET', '/me');
      const kp = keyPairRef.current;
      const sharedKey = me.pair?.partner_public_key && kp ? sharedKeyWith(kp, me.pair.partner_public_key) : null;
      setState((s) => ({ ...s, me, sharedKey }));
      return me;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await clearToken();
        setAuthToken(null);
        setState((s) => ({ ...s, token: null, userId: null, me: null, sharedKey: null }));
      }
      return null;
    }
  }, []);

  const signIn = useCallback(
    async (token: string, userId: string) => {
      await saveToken(token, userId);
      setAuthToken(token);
      setState((s) => ({ ...s, token, userId }));
      const kp = await ensureKeys();
      const me = await api<MeView>('GET', '/me');
      if (!me.has_public_key) await api('PUT', '/me/public-key', { public_key: toBase64(kp.publicKey) });
      await refreshMe();
    },
    [ensureKeys, refreshMe],
  );

  const setOnboarded = useCallback(async (v: boolean) => {
    await AsyncStorage.setItem(ONBOARDED_KEY, v ? '1' : '0');
    setState((s) => ({ ...s, onboarded: v }));
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api('DELETE', '/me/push-token');
    } catch {
      /* çevrimdışı olabilir */
    }
    await clearToken();
    setAuthToken(null);
    setState((s) => ({ ...s, token: null, userId: null, me: null, sharedKey: null }));
  }, []);

  const deleteAccount = useCallback(async () => {
    await api('DELETE', '/account');
    await clearToken();
    await deleteKeyPair();
    await AsyncStorage.removeItem(ONBOARDED_KEY);
    keyPairRef.current = null;
    setAuthToken(null);
    setState({ booting: false, token: null, userId: null, me: null, keyPair: null, sharedKey: null, onboarded: false });
  }, []);

  useEffect(() => {
    (async () => {
      const onboarded = (await AsyncStorage.getItem(ONBOARDED_KEY)) === '1';
      const saved = await loadToken();
      if (saved) {
        setAuthToken(saved.token);
        setState((s) => ({ ...s, token: saved.token, userId: saved.userId, onboarded }));
        await ensureKeys();
        await refreshMe();
      } else {
        setState((s) => ({ ...s, onboarded }));
      }
      setState((s) => ({ ...s, booting: false }));
    })();
  }, [ensureKeys, refreshMe]);

  const value = useMemo(
    () => ({ ...state, signIn, refreshMe, ensureKeys, adoptPair, setOnboarded, signOut, deleteAccount }),
    [state, signIn, refreshMe, ensureKeys, adoptPair, setOnboarded, signOut, deleteAccount],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('SessionProvider missing');
  return v;
}
