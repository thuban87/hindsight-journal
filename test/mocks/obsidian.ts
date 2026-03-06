/**
 * Obsidian API Mock
 * 
 * This file provides mock implementations of Obsidian's API
 * for use in Vitest tests. It's aliased via vitest.config.ts.
 */

// ============== Platform ==============

export const Platform = {
    isMobile: false,
    isDesktop: true,
    isMacOS: false,
    isWin: true,
    isIosApp: false,
    isAndroidApp: false,
};

// ============== App & Plugin ==============

export class MetadataCache {
    getFileCache(_file: TFile): { frontmatter?: Record<string, unknown> } | null {
        return null;
    }
    on(_event: string, _callback: (...args: unknown[]) => void): void { }
}

export class App {
    vault = new Vault();
    metadataCache = new MetadataCache();
    workspace = {
        onLayoutReady: (cb: () => void) => cb(),
        getLeavesOfType: (_type: string) => [],
        getLeftLeaf: (_split: boolean) => null,
        getLeaf: (_type: string) => null,
        openLinkText: async (_link: string, _source: string) => { },
    };
    fileManager = {
        processFrontMatter: async (_file: TFile, _fn: (fm: Record<string, unknown>) => void) => { },
    };
}

export class Plugin {
    app: App;
    manifest: { id: string; version: string };

    constructor(app: App, manifest: { id: string; version: string }) {
        this.app = app;
        this.manifest = manifest;
    }

    async loadData(): Promise<unknown> {
        return {};
    }

    async saveData(_data: unknown): Promise<void> { }

    addCommand(_command: unknown): void { }
    registerView(_type: string, _factory: unknown): void { }
    addSettingTab(_tab: unknown): void { }
    registerEvent(_event: unknown): void { }
}

// ============== Modal ==============

export class Modal {
    app: App;
    contentEl: HTMLElement;

    constructor(app: App) {
        this.app = app;
        this.contentEl = document.createElement('div');
    }

    open(): void { }
    close(): void { }
    onOpen(): void { }
    onClose(): void { }
}

// ============== Notice ==============

export class Notice {
    constructor(_message: string, _timeout?: number) { }
}

// ============== Vault & Files ==============

export class Vault {
    getAbstractFileByPath(_path: string): TAbstractFile | null {
        return null;
    }

    getFolderByPath(_path: string): TFolder | null {
        return null;
    }

    getFileByPath(_path: string): TFile | null {
        return null;
    }

    getResourcePath(_file: TFile): string {
        return '/mock/resource/path';
    }

    async read(_file: TFile): Promise<string> {
        return '';
    }

    async cachedRead(_file: TFile): Promise<string> {
        return '';
    }

    async modify(_file: TFile, _data: string): Promise<void> { }
    async create(_path: string, _data: string): Promise<TFile> {
        return new TFile();
    }
    async createFolder(_path: string): Promise<void> { }

    on(_event: string, _callback: (...args: unknown[]) => void): { id: string } {
        return { id: 'mock-event' };
    }

    adapter = {
        exists: async (_path: string): Promise<boolean> => true,
        read: async (_path: string): Promise<string> => '',
        write: async (_path: string, _data: string): Promise<void> => { },
        writeBinary: async (_path: string, _data: ArrayBuffer): Promise<void> => { },
        remove: async (_path: string): Promise<void> => { },
        getResourcePath: (path: string): string => `app://local/${path}`,
    };
}

export class TAbstractFile {
    path: string = '';
    name: string = '';
}

export class TFile extends TAbstractFile {
    extension: string = 'md';
    stat = { mtime: Date.now(), ctime: Date.now(), size: 0 };
}

export class TFolder extends TAbstractFile {
    children: TAbstractFile[] = [];
}

// ============== Settings ==============

export class Setting {
    constructor(_containerEl: HTMLElement) { }
    setHeading(): this { return this; }
    setName(_name: string): this { return this; }
    setDesc(_desc: string): this { return this; }
    addText(_cb: (text: unknown) => void): this { return this; }
    addToggle(_cb: (toggle: unknown) => void): this { return this; }
    addDropdown(_cb: (dropdown: unknown) => void): this { return this; }
    addButton(_cb: (button: unknown) => void): this { return this; }
    addSlider(_cb: (slider: unknown) => void): this { return this; }
}

export class PluginSettingTab {
    app: App;
    plugin: Plugin;
    containerEl: HTMLElement;

    constructor(app: App, plugin: Plugin) {
        this.app = app;
        this.plugin = plugin;
        this.containerEl = document.createElement('div');
    }

    display(): void { }
    hide(): void { }
}

// ============== Views ==============

export class ItemView {
    app: App;
    leaf: WorkspaceLeaf;
    containerEl: HTMLElement;

    constructor(leaf: WorkspaceLeaf) {
        this.leaf = leaf;
        this.app = {} as App;
        this.containerEl = document.createElement('div');
    }

    getViewType(): string { return ''; }
    getDisplayText(): string { return ''; }
    getIcon(): string { return 'document'; }
    onOpen(): Promise<void> { return Promise.resolve(); }
    onClose(): Promise<void> { return Promise.resolve(); }
}

export class WorkspaceLeaf {
    view: ItemView | null = null;
}

export class MarkdownView extends ItemView {
    file: TFile | null = null;
    editor = {};
}

// ============== Menu ==============

export class Menu {
    addItem(_cb: (item: MenuItem) => void): this { return this; }
    showAtMouseEvent(_event: MouseEvent): void { }
    showAtPosition(_pos: { x: number; y: number }): void { }
}

export class MenuItem {
    setTitle(_title: string): this { return this; }
    setIcon(_icon: string): this { return this; }
    onClick(_cb: () => void): this { return this; }
}

// ============== Network ==============

export async function requestUrl(_options: { url: string; timeout?: number }): Promise<{
    status: number;
    headers: Record<string, string>;
    text: string;
    arrayBuffer: ArrayBuffer;
}> {
    return { status: 200, headers: {}, text: '{}', arrayBuffer: new ArrayBuffer(0) };
}

// ============== DataAdapter ==============

export class DataAdapter {
    async exists(_path: string): Promise<boolean> { return true; }
    async read(_path: string): Promise<string> { return ''; }
    async write(_path: string, _data: string): Promise<void> { }
    async writeBinary(_path: string, _data: ArrayBuffer): Promise<void> { }
    async remove(_path: string): Promise<void> { }
    getResourcePath(path: string): string { return `app://local/${path}`; }
}

// ============== Misc ==============

export function debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delay: number
): T {
    let timeout: NodeJS.Timeout;
    return ((...args: unknown[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    }) as T;
}

export function normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
}
