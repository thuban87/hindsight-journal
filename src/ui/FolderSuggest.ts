/**
 * Folder Suggest
 *
 * Provides autocomplete suggestions for vault folder paths
 * in settings text inputs. Extends Obsidian's AbstractInputSuggest.
 */

import { AbstractInputSuggest, App, TFolder } from 'obsidian';

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
    private textInputEl: HTMLInputElement;

    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this.textInputEl = inputEl;
    }

    /** Collect all folders in the vault matching the query */
    getSuggestions(query: string): TFolder[] {
        const lowerQuery = query.toLowerCase();
        const folders: TFolder[] = [];

        // Walk all folders in the vault
        const walk = (folder: TFolder): void => {
            // Skip the vault root itself
            if (folder.path && folder.path.toLowerCase().includes(lowerQuery)) {
                folders.push(folder);
            }
            for (const child of folder.children) {
                if (child instanceof TFolder) {
                    walk(child);
                }
            }
        };

        walk(this.app.vault.getRoot() as TFolder);
        return folders;
    }

    /** Render a single suggestion in the dropdown */
    renderSuggestion(folder: TFolder, el: HTMLElement): void {
        el.setText(folder.path);
    }

    /** Handle selection of a suggestion */
    selectSuggestion(folder: TFolder): void {
        this.textInputEl.value = folder.path;
        this.textInputEl.dispatchEvent(new Event('input'));
        // Trigger blur to save the setting
        this.textInputEl.blur();
        this.close();
    }
}

