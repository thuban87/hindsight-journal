/**
 * Annotation Input
 *
 * UI for adding annotations to journal entries.
 * Shows text input, preset suggestions from settings, existing annotations
 * with remove buttons, and a count indicator near the limit.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore } from '../../store/settingsStore';

interface AnnotationInputProps {
    filePath: string;
}

export function AnnotationInput({ filePath }: AnnotationInputProps): React.ReactElement | null {
    const plugin = useAppStore(s => s.plugin);
    const annotationPresets = useSettingsStore(s => s.settings.annotationPresets);
    const [text, setText] = useState('');
    const [annotations, setAnnotations] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const annotationService = plugin?.services.annotationService;

    // Load existing annotations
    useEffect(() => {
        if (!annotationService) return;
        setLoading(true);
        void annotationService.getAnnotations(filePath).then(anns => {
            setAnnotations(anns);
            setLoading(false);
        });
    }, [annotationService, filePath]);

    const handleAdd = useCallback(async (annotationText: string) => {
        if (!annotationService) return;
        const trimmed = annotationText.trim();
        if (trimmed === '') return;

        await annotationService.addAnnotation(filePath, trimmed);
        const updated = await annotationService.getAnnotations(filePath);
        setAnnotations(updated);
        setText('');
    }, [annotationService, filePath]);

    const handleRemove = useCallback(async (annotation: string) => {
        if (!annotationService) return;
        await annotationService.removeAnnotation(filePath, annotation);
        const updated = await annotationService.getAnnotations(filePath);
        setAnnotations(updated);
    }, [annotationService, filePath]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            void handleAdd(text);
        }
    }, [handleAdd, text]);

    if (!annotationService) return null;

    // Filter presets to those not already added
    const availablePresets = annotationPresets.filter(p => !annotations.includes(p));

    return (
        <div className="hindsight-annotation-input">
            <div className="hindsight-annotation-input-row">
                <input
                    type="text"
                    className="hindsight-annotation-text"
                    placeholder="Add annotation..."
                    maxLength={500}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    aria-label="Annotation text"
                />
                <button
                    className="hindsight-annotation-add-btn"
                    onClick={() => void handleAdd(text)}
                    disabled={text.trim() === ''}
                >
                    Add
                </button>
            </div>

            {/* Count indicator near limit */}
            {annotations.length >= 15 && (
                <div className="hindsight-annotation-count">
                    {annotations.length}/20 annotations
                </div>
            )}

            {/* Preset suggestions */}
            {availablePresets.length > 0 && (
                <div className="hindsight-annotation-presets">
                    {availablePresets.map(preset => (
                        <button
                            key={preset}
                            className="hindsight-annotation-preset-btn"
                            onClick={() => void handleAdd(preset)}
                            title={preset}
                        >
                            + {preset}
                        </button>
                    ))}
                </div>
            )}

            {/* Existing annotations */}
            {loading ? (
                <div className="hindsight-annotation-loading">Loading...</div>
            ) : annotations.length > 0 ? (
                <div className="hindsight-annotation-list">
                    {annotations.map((ann, i) => (
                        <div key={`${ann}-${i}`} className="hindsight-annotation-item">
                            <span className="hindsight-annotation-text-display">{ann}</span>
                            <button
                                className="hindsight-annotation-remove-btn"
                                onClick={() => void handleRemove(ann)}
                                aria-label={`Remove annotation: ${ann}`}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
