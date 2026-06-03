import { invoke } from '@tauri-apps/api/core';
import type { PersistedAppState } from '../types/app';

export const isTauriRuntime = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const browserMemory = new Map<string, unknown>();
const browserSecrets = new Map<string, string>();

export async function loadAppState(): Promise<Partial<PersistedAppState>> {
  if (!isTauriRuntime()) {
    return (browserMemory.get('appState') as Partial<PersistedAppState>) ?? {};
  }
  return invoke<Partial<PersistedAppState>>('load_app_state');
}

export async function saveAppState(state: PersistedAppState): Promise<void> {
  if (!isTauriRuntime()) {
    browserMemory.set('appState', state);
    return;
  }
  await invoke('save_app_state', { state });
}

export async function readTextFile(path: string): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error('本地文件读取需要在 Tauri 桌面环境中运行。');
  }
  return invoke<string>('read_text_file', { path });
}

export async function writeTextFile(path: string, text: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error('本地文件保存需要在 Tauri 桌面环境中运行。');
  }
  await invoke('write_text_file', { path, text });
}

export async function getSecret(account: string): Promise<string | null> {
  if (!isTauriRuntime()) {
    return browserSecrets.get(account) ?? null;
  }
  return invoke<string | null>('get_secret', { account });
}

export async function setSecret(account: string, value: string): Promise<void> {
  if (!isTauriRuntime()) {
    browserSecrets.set(account, value);
    return;
  }
  await invoke('set_secret', { account, value });
}

export async function deleteSecret(account: string): Promise<void> {
  if (!isTauriRuntime()) {
    browserSecrets.delete(account);
    return;
  }
  await invoke('delete_secret', { account });
}
