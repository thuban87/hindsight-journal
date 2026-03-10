/**
 * Types — Barrel Re-exports
 *
 * Central index for all type modules. Import from here
 * rather than individual type files.
 */

// Settings
export type { HindsightSettings, GoalConfig } from './settings';
export { DEFAULT_SETTINGS } from './settings';

// Journal
export type { JournalEntry, ParsedSection } from './journal';

// Metrics
export type { FrontmatterField, MetricDataPoint, DateRange } from './metrics';

// Plugin interface
export type { HindsightPluginInterface, ServiceRegistry } from './plugin';

// Insights
export type { AlertSeverity, TrendAlert, CorrelationResult, ConditionalInsight, PersonalBest } from './insights';
