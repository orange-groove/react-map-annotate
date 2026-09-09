"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Annotation } from "../core/types";

/**
 * Holds the geometry of an in-flight gesture outside React state.
 *
 * A drag produces a pointer event per frame or faster. Routing each one
 * through `setState` re-renders the provider, every `useAnnotate()` consumer,
 * and the host, then hands six fresh FeatureCollections to the map. The store
 * keeps live geometry here instead, coalesces to one notification per frame,
 * and only the paint layer subscribes. The session catches up in a single
 * commit when the gesture ends.
 */
export interface LiveEditStore {
  subscribe: (listener: () => void) => () => void;
  getVersion: () => number;
  /** True while a gesture is holding geometry that the session has not seen. */
  isActive: () => boolean;
  /** Records live geometry and schedules one notification for this frame. */
  set: (items: Annotation[]) => void;
  /** Returns the pending geometry and empties the store. */
  drain: () => Annotation[];
  clear: () => void;
  /** Overlays pending geometry on a committed list, by reference when idle. */
  apply: (base: Annotation[]) => Annotation[];
}

export function createLiveEditStore(): LiveEditStore {
  const overrides = new Map<string, Annotation>();
  const listeners = new Set<() => void>();
  let version = 0;
  let frame = 0;
  let cacheBase: Annotation[] | null = null;
  let cacheVersion = -1;
  let cacheResult: Annotation[] = [];

  const emit = () => {
    version += 1;
    for (const listener of [...listeners]) listener();
  };

  const flush = () => {
    frame = 0;
    emit();
  };

  const schedule = () => {
    if (frame) return;
    if (typeof requestAnimationFrame !== "function") {
      emit();
      return;
    }
    frame = requestAnimationFrame(flush);
  };

  const cancel = () => {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
  };

  const reset = () => {
    cancel();
    if (overrides.size === 0) return false;
    overrides.clear();
    return true;
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getVersion: () => version,
    isActive: () => overrides.size > 0,
    set(items) {
      if (items.length === 0) return;
      for (const item of items) overrides.set(item.id, item);
      schedule();
    },
    drain() {
      cancel();
      const items = [...overrides.values()];
      if (reset()) emit();
      return items;
    },
    clear() {
      if (reset()) emit();
    },
    apply(base) {
      if (overrides.size === 0) return base;
      if (cacheBase === base && cacheVersion === version) return cacheResult;
      cacheBase = base;
      cacheVersion = version;
      cacheResult = base.map(
        (annotation) => overrides.get(annotation.id) ?? annotation,
      );
      return cacheResult;
    },
  };
}

const LiveEditContext = createContext<LiveEditStore | null>(null);

export function LiveEditProvider({
  store,
  children,
}: {
  store: LiveEditStore;
  children: ReactNode;
}) {
  return (
    <LiveEditContext.Provider value={store}>
      {children}
    </LiveEditContext.Provider>
  );
}

export function useLiveEditStore(): LiveEditStore | null {
  return useContext(LiveEditContext);
}

const NO_SUBSCRIBE = () => () => undefined;
const NO_VERSION = () => 0;

/**
 * Committed annotations with any in-flight gesture painted on top. Returns the
 * base array by reference when nothing is being dragged, so downstream memos
 * are untouched outside a gesture.
 */
export function useLiveAnnotations(base: Annotation[]): Annotation[] {
  const store = useLiveEditStore();
  const version = useSyncExternalStore(
    store?.subscribe ?? NO_SUBSCRIBE,
    store?.getVersion ?? NO_VERSION,
    NO_VERSION,
  );
  return useMemo(
    () => (store ? store.apply(base) : base),
    // The store mutates in place, so the version is what makes this stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, store, version],
  );
}
