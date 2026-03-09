/**
 * App Store
 *
 * Zustand store for App and HindsightPluginInterface singletons.
 * Initialized once in onload(), reset in onunload().
 *
 * This replaces prop-drilling `app: App` through the React component tree.
 * Since there are multiple React roots (Main View, Sidebar, modals),
 * React Context would require wrapping every root. Zustand is global.
 *
 * NEVER use non-null assertion (!) on app or plugin from this store.
 * Between onunload() and React root unmount, they may be null.
 * Always: `const app = useAppStore(s => s.app); if (!app) return null;`
 */

import { create } from 'zustand';
import type { App } from 'obsidian';
import type { HindsightPluginInterface } from '../types/plugin';

interface AppState {
    app: App | null;
    plugin: HindsightPluginInterface | null;
    isUnloading: boolean;
    setApp: (app: App, plugin: HindsightPluginInterface) => void;
    setIsUnloading: (v: boolean) => void;
    reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    app: null,
    plugin: null,
    isUnloading: false,
    setApp: (app, plugin) => set({ app, plugin, isUnloading: false }),
    setIsUnloading: (isUnloading) => set({ isUnloading }),
    reset: () => set({ app: null, plugin: null, isUnloading: false }),
}));
