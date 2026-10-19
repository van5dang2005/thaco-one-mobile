import * as SecureStore from 'expo-secure-store';

import { kv, kvKeys, writeJSON } from '@/core/storage/kv';

import { type BiometricAccount, biometricAccount, dropOthersBiometric, isBiometricEnabled } from '../biometric';

jest.mock('expo-secure-store', () => ({ deleteItemAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-local-authentication', () => ({}));

const deleteToken = SecureStore.deleteItemAsync as jest.Mock;

/** Account A turned biometric sign-in on, by email login. */
const accountA: BiometricAccount = { username: 'nguyenvana', domain: 'thaco.com.vn', sessionId: 's-a', userId: 'user-a' };

function enable(account: BiometricAccount) {
  writeJSON(kvKeys.biometricAccount, account);
}

beforeEach(() => {
  kv.clearAll();
  deleteToken.mockClear();
});

describe('dropOthersBiometric', () => {
  it('turns biometric sign-in off when another account signs in', async () => {
    enable(accountA);
    await dropOthersBiometric({ login: { username: 'tranthib', domain: 'thaco.com.vn' }, userId: 'user-b' });
    expect(isBiometricEnabled()).toBe(false);
    expect(deleteToken).toHaveBeenCalledTimes(1);
  });

  it('keeps it for the same Keycloak user signing in another way (MSNV instead of email)', async () => {
    enable(accountA);
    await dropOthersBiometric({ login: { username: '0123456', domain: '' }, userId: 'user-a' });
    expect(biometricAccount()).toEqual(accountA);
    expect(deleteToken).not.toHaveBeenCalled();
  });

  it('compares username and domain when the Keycloak user is unknown', async () => {
    enable({ ...accountA, userId: undefined });
    await dropOthersBiometric({ login: { username: ' NguyenVanA ', domain: 'thaco.com.vn' }, userId: 'user-a' });
    expect(isBiometricEnabled()).toBe(true);

    await dropOthersBiometric({ login: { username: 'tranthib', domain: 'thaco.com.vn' } });
    expect(isBiometricEnabled()).toBe(false);
  });

  it('does nothing when biometric sign-in is off', async () => {
    await dropOthersBiometric({ login: { username: 'tranthib', domain: 'thaco.com.vn' }, userId: 'user-b' });
    expect(deleteToken).not.toHaveBeenCalled();
  });
});
