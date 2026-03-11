/**
 * Shared Resize Observer
 *
 * Provides a single ResizeObserver instance shared across all items
 * within a VirtualVariableList. Each item row calls observe(el, callback)
 * on mount and unobserve(el) on unmount. The observer is created lazily
 * and destroyed when all items have been unobserved.
 *
 * This avoids instantiating hundreds of individual ResizeObserver instances
 * (one per visible row), which causes severe performance degradation.
 *
 * Instance-scoped via React context — each VirtualVariableList owns its
 * own observer; items within that list share it.
 */

import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';

type ObserverCallback = (entry: ResizeObserverEntry) => void;

interface SharedObserverAPI {
    observe: (el: HTMLElement, callback: ObserverCallback) => void;
    unobserve: (el: HTMLElement) => void;
}

const SharedObserverContext = createContext<SharedObserverAPI | null>(null);

/**
 * Hook to access the shared ResizeObserver from within a VirtualVariableList item.
 */
export function useSharedObserver(): SharedObserverAPI {
    const ctx = useContext(SharedObserverContext);
    if (!ctx) {
        throw new Error('useSharedObserver must be used within a SharedObserverProvider');
    }
    return ctx;
}

/**
 * Provider component that manages the shared ResizeObserver instance.
 * Mount this as a parent of all VirtualVariableList items.
 */
export function SharedObserverProvider({ children }: { children: React.ReactNode }): React.ReactElement {
    const observerRef = useRef<ResizeObserver | null>(null);
    const callbacksRef = useRef<Map<Element, ObserverCallback>>(new Map());

    const getOrCreateObserver = useCallback((): ResizeObserver => {
        if (!observerRef.current) {
            observerRef.current = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const cb = callbacksRef.current.get(entry.target);
                    if (cb) cb(entry);
                }
            });
        }
        return observerRef.current;
    }, []);

    const observe = useCallback((el: HTMLElement, callback: ObserverCallback) => {
        callbacksRef.current.set(el, callback);
        getOrCreateObserver().observe(el);
    }, [getOrCreateObserver]);

    const unobserve = useCallback((el: HTMLElement) => {
        callbacksRef.current.delete(el);
        if (observerRef.current) {
            observerRef.current.unobserve(el);
            // Destroy observer when no more elements are being observed
            if (callbacksRef.current.size === 0) {
                observerRef.current.disconnect();
                observerRef.current = null;
            }
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
            }
            callbacksRef.current.clear();
        };
    }, []);

    const api = useRef<SharedObserverAPI>({ observe, unobserve });
    api.current = { observe, unobserve };

    // Use a stable ref-based object for context to avoid re-renders
    const stableApi = useRef<SharedObserverAPI>({
        observe: (el, cb) => api.current.observe(el, cb),
        unobserve: (el) => api.current.unobserve(el),
    });

    return React.createElement(
        SharedObserverContext.Provider,
        { value: stableApi.current },
        children
    );
}
