/**
 * Plugin Interface Types
 *
 * Defines the interface that components and services use to access
 * the plugin instance. Avoids circular imports with main.ts.
 */

import type { JournalIndexService } from '../services/JournalIndexService';
import type { ThumbnailService } from '../services/ThumbnailService';
import type { HindsightSettings } from './settings';

/**
 * Registry of all plugin services.
 * Components access services through plugin.services.
 * Keeps appStore lean (app, plugin, isUnloading only).
 */
export interface ServiceRegistry {
    journalIndex: JournalIndexService | null;
    thumbnailService: ThumbnailService | null;
}

/**
 * Interface for the plugin instance exposed to React components and services.
 * main.ts implements this interface. Using an interface instead of the
 * concrete class avoids circular imports (main.ts → appStore → main.ts).
 */
export interface HindsightPluginInterface {
    settings: HindsightSettings;
    saveSettings(): Promise<void>;
    services: ServiceRegistry;
}
