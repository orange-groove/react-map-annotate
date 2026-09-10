"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type {
  AnnotateCallbacks,
  AnnotateFont,
  Annotation,
  AnnotationStyle,
  AnnotateTool,
  ChangeCause,
  ChangeMeta,
  DraftAnnotation,
  SelectOptions,
  TraceOption,
} from "../core/types";
import { IDLE_TOOL } from "../core/constants";
import {
  canPressFinish,
  removeAnnotation,
  removeAnnotations,
  setAnnotationColor,
  setAnnotationLabel,
  setAnnotationStyle,
  upsertAnnotation,
  upsertAnnotations,
} from "../core/utils/annotations";
import {
  canGroupAnnotations,
  canUngroupAnnotations,
  expandGroupIds,
  groupAnnotations,
  nextSelectedIds,
  uniqueIds,
  ungroupAnnotations,
} from "../core/utils/selection";
import {
  canRemoveVertex,
  editableVertices,
  removeVertex,
} from "../core/utils/edit";
import {
  HISTORY_LIMIT,
  annotationsEqual,
  cloneAnnotations,
  sameGeometry,
  sameIds,
} from "./history";
import {
  LiveEditProvider,
  createLiveEditStore,
  type LiveEditStore,
} from "./live-edits";
import { AnnotateFontLoader } from "./annotate-fonts";
import { resolveAnnotateFonts } from "../core/utils/fonts";

export interface AnnotateSession {
  annotations: Annotation[];
  setAnnotations: Dispatch<SetStateAction<Annotation[]>>;
  draft: DraftAnnotation | null;
  setDraft: (draft: DraftAnnotation | null) => void;
  tool: AnnotateTool;
  setTool: (tool: AnnotateTool) => void;
  selectedId: string | null;
  selectedIds: string[];
  setSelectedId: (id: string | null, options?: SelectOptions) => void;
  setSelectedIds: (ids: string[]) => void;
  selectedVertexIndex: number | null;
  setSelectedVertexIndex: (index: number | null) => void;
  setLabel: (id: string, label: string) => void;
  setColor: (id: string, color: string) => void;
  setStyle: (id: string, style: AnnotationStyle) => void;
  fonts: AnnotateFont[];
  defaultFontFamily?: string;
  onAdd: (annotation: Annotation) => void;
  onAddMany: (annotations: Annotation[]) => void;
  onUpdate: (annotation: Annotation) => void;
  onUpdateMany: (annotations: Annotation[]) => void;
  onDelete: (id: string) => void;
  onDraftChange: (draft: DraftAnnotation | null) => void;
  onToolChange: (tool: AnnotateTool) => void;
  onSelect: (id: string | null, options?: SelectOptions) => void;
  onLabelChange: (id: string, label: string, annotation: Annotation) => void;
  canFinish: boolean;
  finish: () => void;
  registerFinish: (fn: (() => void) | null) => void;
  /**
   * Lets the map layer settle live geometry before it is committed, for work
   * too expensive to run per frame (measure sampling against terrain).
   */
  registerCommitTransform: (
    fn: ((items: Annotation[]) => Annotation[]) | null,
  ) => void;
  beginEdit: () => void;
  endEdit: () => void;
  /** True between the first live edit of a gesture and its commit. */
  isEditing: boolean;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  removeSelected: () => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  canGroup: boolean;
  canUngroup: boolean;
  showLabels: boolean;
  showArea: boolean;
  trace?: TraceOption;
}

export interface AnnotateProviderProps extends AnnotateCallbacks {
  children: ReactNode;
  initialAnnotations?: Annotation[];
  initialTool?: AnnotateTool;
  annotations?: Annotation[];
  draft?: DraftAnnotation | null;
  tool?: AnnotateTool;
  selectedId?: string | null;
  selectedIds?: string[];
  onChange?: (annotations: Annotation[], meta: ChangeMeta) => void;
  /** Fires only when a gesture ends or a discrete change lands. Persist here. */
  onCommit?: (annotations: Annotation[], meta: ChangeMeta) => void;
  /**
   * Also fire `onChange` while a gesture is in flight, at most once per frame.
   * Off by default: live geometry paints from the library's own store, so a
   * host that turns this on pays a render per frame for information it will
   * receive again on commit.
   */
  emitLiveChanges?: boolean;
  fonts?: AnnotateFont[];
  defaultFontFamily?: string;
  showLabels?: boolean;
  showArea?: boolean;
  trace?: TraceOption;
}

const AnnotateContext = createContext<AnnotateSession | null>(null);

export function AnnotateProvider({
  children,
  initialAnnotations = [],
  initialTool = IDLE_TOOL,
  annotations: annotationsProp,
  draft: draftProp,
  tool: toolProp,
  selectedId: selectedIdProp,
  selectedIds: selectedIdsProp,
  onChange,
  onCommit,
  emitLiveChanges = false,
  onAdd: onAddProp,
  onUpdate: onUpdateProp,
  onDelete: onDeleteProp,
  onDraftChange: onDraftChangeProp,
  onToolChange: onToolChangeProp,
  onSelect: onSelectProp,
  onSelectIds: onSelectIdsProp,
  onLabelChange: onLabelChangeProp,
  onColorChange: onColorChangeProp,
  fonts: fontsProp,
  defaultFontFamily,
  showLabels = true,
  showArea = true,
  trace,
}: AnnotateProviderProps) {
  const [annotationsState, setAnnotationsState] = useState<Annotation[]>(
    () => annotationsProp ?? initialAnnotations,
  );
  const [draftState, setDraftState] = useState<DraftAnnotation | null>(null);
  const [toolState, setToolState] = useState<AnnotateTool>(initialTool);
  const [selectedIdState, setSelectedIdState] = useState<string | null>(null);
  const [selectedIdsState, setSelectedIdsState] = useState<string[]>([]);
  const [selectedVertexIndex, setSelectedVertexIndexState] = useState<
    number | null
  >(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const fonts = useMemo(() => resolveAnnotateFonts(fontsProp), [fontsProp]);
  const finishImplRef = useRef<(() => void) | null>(null);
  const pastRef = useRef<Annotation[][]>([]);
  const futureRef = useRef<Annotation[][]>([]);
  const editingRef = useRef(false);
  // Set only by beginEdit, which the pointer handlers call on pointer-down.
  // While it is true, geometry belongs to the live store instead of state.
  const gestureRef = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const liveRef = useRef<LiveEditStore>(undefined as never);
  if (!liveRef.current) liveRef.current = createLiveEditStore();
  const live = liveRef.current;
  const liveIdsRef = useRef<Set<string>>(new Set());
  const commitTransformRef = useRef<
    ((items: Annotation[]) => Annotation[]) | null
  >(null);
  // The exact array last handed to onChange. A controlled host that passes it
  // straight back is echoing us, not supplying new truth.
  const lastEmittedRef = useRef<Annotation[] | undefined>(undefined);
  // Our last commit, and the list it replaced, held until a controlled host
  // catches up. A host that remaps annotations can only ever hand back a new
  // array, so reference identity cannot tell its stale render apart from real
  // news; these two are what a stale render is recognised against.
  const committedRef = useRef<Annotation[] | undefined>(undefined);
  const replacedRef = useRef<Annotation[] | undefined>(undefined);
  // The session list as it stood when the current gesture opened.
  const editStartRef = useRef<Annotation[] | undefined>(undefined);

  const annotations = annotationsState;
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotationsState;
  const selectedIdRef = useRef(selectedIdProp ?? selectedIdState);
  const selectedIdsRef = useRef<string[]>(selectedIdsProp ?? selectedIdsState);
  const selectedVertexIndexRef = useRef<number | null>(null);
  const draft = draftProp ?? draftState;
  const tool = toolProp ?? toolState;
  const selectedIds = selectedIdsProp ?? selectedIdsState;
  const selectedId =
    selectedIdProp ?? selectedIds[selectedIds.length - 1] ?? selectedIdState;
  selectedIdRef.current = selectedId;
  selectedIdsRef.current = selectedIds;
  selectedVertexIndexRef.current = selectedVertexIndex;

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const pushPast = useCallback(() => {
    pastRef.current = [
      ...pastRef.current,
      cloneAnnotations(annotationsRef.current),
    ].slice(-HISTORY_LIMIT);
    futureRef.current = [];
  }, []);

  const notify = useCallback(
    (next: Annotation[], meta: ChangeMeta, previous?: Annotation[]) => {
      lastEmittedRef.current = next;
      if (meta.reason === "commit") {
        replacedRef.current = previous;
        committedRef.current = next;
      }
      onChange?.(next, meta);
      if (meta.reason === "commit") onCommit?.(next, meta);
    },
    [onChange, onCommit],
  );

  const commitAnnotations = useCallback(
    (next: Annotation[], meta: ChangeMeta) => {
      const previous = annotationsRef.current;
      annotationsRef.current = next;
      setAnnotationsState(next);
      notify(next, meta, previous);
    },
    [notify],
  );

  const recordCommit = useCallback(
    (next: Annotation[], cause: ChangeCause, ids: string[] = []) => {
      if (annotationsEqual(annotationsRef.current, next)) return;
      if (!editingRef.current) pushPast();
      commitAnnotations(next, { reason: "commit", cause, ids });
      syncHistoryFlags();
    },
    [commitAnnotations, pushPast, syncHistoryFlags],
  );

  const openEdit = useCallback(() => {
    if (editingRef.current) return;
    pushPast();
    editStartRef.current = annotationsRef.current;
    editingRef.current = true;
    setIsEditing(true);
    syncHistoryFlags();
  }, [pushPast, syncHistoryFlags]);

  const beginEdit = useCallback(() => {
    openEdit();
    gestureRef.current = true;
  }, [openEdit]);

  const endEdit = useCallback(() => {
    if (!editingRef.current) return;
    editingRef.current = false;
    gestureRef.current = false;
    setIsEditing(false);
    const ids = [...liveIdsRef.current];
    liveIdsRef.current.clear();
    const started = editStartRef.current;
    editStartRef.current = undefined;
    const drained = live.drain();
    const settled = commitTransformRef.current
      ? commitTransformRef.current(drained)
      : drained;
    const previous = annotationsRef.current;
    const merged =
      settled.length > 0 ? upsertAnnotations(previous, settled) : previous;
    const changed = merged !== previous && !annotationsEqual(previous, merged);
    const next = changed ? merged : previous;
    // One React commit for the whole gesture.
    if (changed) {
      annotationsRef.current = next;
      setAnnotationsState(next);
    }
    // What the host was last told, which is what separates a gesture that
    // moved something from one that ended where it began. Whether the geometry
    // came from the gesture's own store or reached state some other way, the
    // host hears about it once; a click that moved nothing stays quiet.
    const known = committedRef.current ?? started ?? previous;
    if (!annotationsEqual(known, next)) {
      notify(next, { reason: "commit", cause: "edit", ids }, known);
      if (changed) {
        for (const item of settled) onUpdateProp?.(item);
      }
    }
    const last = pastRef.current[pastRef.current.length - 1];
    if (last && annotationsEqual(last, annotationsRef.current)) {
      pastRef.current = pastRef.current.slice(0, -1);
    }
    syncHistoryFlags();
  }, [live, notify, onUpdateProp, syncHistoryFlags]);

  const undo = useCallback(() => {
    if (editingRef.current) endEdit();
    const previous = pastRef.current[pastRef.current.length - 1];
    if (!previous) return;
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [
      ...futureRef.current,
      cloneAnnotations(annotationsRef.current),
    ];
    commitAnnotations(cloneAnnotations(previous), {
      reason: "commit",
      cause: "undo",
      ids: [],
    });
    selectedVertexIndexRef.current = null;
    setSelectedVertexIndexState(null);
    syncHistoryFlags();
  }, [commitAnnotations, endEdit, syncHistoryFlags]);

  const redo = useCallback(() => {
    if (editingRef.current) endEdit();
    const next = futureRef.current[futureRef.current.length - 1];
    if (!next) return;
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [
      ...pastRef.current,
      cloneAnnotations(annotationsRef.current),
    ].slice(-HISTORY_LIMIT);
    commitAnnotations(cloneAnnotations(next), {
      reason: "commit",
      cause: "redo",
      ids: [],
    });
    selectedVertexIndexRef.current = null;
    setSelectedVertexIndexState(null);
    syncHistoryFlags();
  }, [commitAnnotations, endEdit, syncHistoryFlags]);

  const replaceAnnotations = useCallback<
    Dispatch<SetStateAction<Annotation[]>>
  >(
    (action) => {
      const next =
        typeof action === "function" ? action(annotationsRef.current) : action;
      recordCommit(next, "set");
    },
    [recordCommit],
  );

  const applySelection = useCallback(
    (ids: string[], notify = true) => {
      const next = uniqueIds(ids);
      const primary = next[next.length - 1] ?? null;
      if (primary !== selectedIdRef.current || next.length !== 1) {
        selectedVertexIndexRef.current = null;
        setSelectedVertexIndexState(null);
      }
      selectedIdsRef.current = next;
      selectedIdRef.current = primary;
      if (selectedIdsProp === undefined) setSelectedIdsState(next);
      if (selectedIdProp === undefined) setSelectedIdState(primary);
      if (notify) {
        onSelectProp?.(primary);
        onSelectIdsProp?.(next);
      }
    },
    [onSelectIdsProp, onSelectProp, selectedIdProp, selectedIdsProp],
  );

  const onAdd = useCallback(
    (annotation: Annotation) => {
      endEdit();
      recordCommit(
        upsertAnnotation(annotationsRef.current, annotation),
        "add",
        [annotation.id],
      );
      applySelection([annotation.id]);
      setDraftState(null);
      onAddProp?.(annotation);
    },
    [applySelection, endEdit, onAddProp, recordCommit],
  );

  const onAddMany = useCallback(
    (items: Annotation[]) => {
      if (items.length === 0) return;
      endEdit();
      recordCommit(
        upsertAnnotations(annotationsRef.current, items),
        "add",
        items.map((item) => item.id),
      );
      applySelection(items.map((item) => item.id));
      setDraftState(null);
      for (const item of items) onAddProp?.(item);
    },
    [applySelection, endEdit, onAddProp, recordCommit],
  );

  /**
   * Inside a pointer gesture, geometry stays out of React state: it goes to
   * the live store, paints from there, and reaches the session, the host, and
   * history once at endEdit. A programmatic call still commits on the spot,
   * and still folds into a single undo step until endEdit closes it.
   */
  const applyUpdates = useCallback(
    (items: Annotation[]) => {
      if (items.length === 0) return;
      if (gestureRef.current) {
        for (const item of items) liveIdsRef.current.add(item.id);
        live.set(items);
        return;
      }
      openEdit();
      recordCommit(
        upsertAnnotations(annotationsRef.current, items),
        "edit",
        items.map((item) => item.id),
      );
      for (const item of items) onUpdateProp?.(item);
    },
    [live, onUpdateProp, openEdit, recordCommit],
  );

  const onUpdate = useCallback(
    (annotation: Annotation) => {
      applyUpdates([annotation]);
    },
    [applyUpdates],
  );

  const onUpdateMany = useCallback(
    (items: Annotation[]) => {
      applyUpdates(items);
    },
    [applyUpdates],
  );

  const onDelete = useCallback(
    (id: string) => {
      endEdit();
      recordCommit(removeAnnotation(annotationsRef.current, id), "delete", [
        id,
      ]);
      const remaining = selectedIdsRef.current.filter((item) => item !== id);
      selectedIdsRef.current = remaining;
      if (selectedIdRef.current === id) {
        selectedIdRef.current = remaining[remaining.length - 1] ?? null;
      }
      if (selectedIdsProp === undefined) setSelectedIdsState(remaining);
      if (selectedIdProp === undefined) {
        setSelectedIdState((current) =>
          current === id ? (remaining[remaining.length - 1] ?? null) : current,
        );
      }
      selectedVertexIndexRef.current = null;
      setSelectedVertexIndexState(null);
      onDeleteProp?.(id);
    },
    [endEdit, onDeleteProp, recordCommit, selectedIdProp, selectedIdsProp],
  );

  const setDraft = useCallback(
    (next: DraftAnnotation | null) => {
      if (draftProp === undefined) setDraftState(next);
      onDraftChangeProp?.(next);
    },
    [draftProp, onDraftChangeProp],
  );

  const setTool = useCallback(
    (next: AnnotateTool) => {
      if (toolProp === undefined) setToolState(next);
      onToolChangeProp?.(next);
    },
    [onToolChangeProp, toolProp],
  );

  const setSelectedId = useCallback(
    (id: string | null, options?: SelectOptions) => {
      applySelection(
        nextSelectedIds(
          annotationsRef.current,
          selectedIdsRef.current,
          id,
          options?.additive,
        ),
      );
    },
    [applySelection],
  );

  const setSelectedIds = useCallback(
    (ids: string[]) => {
      applySelection(expandGroupIds(annotationsRef.current, ids));
    },
    [applySelection],
  );

  const setSelectedVertexIndex = useCallback((index: number | null) => {
    selectedVertexIndexRef.current = index;
    setSelectedVertexIndexState(index);
  }, []);

  const onLabelChange = useCallback(
    (id: string, label: string, annotation: Annotation) => {
      endEdit();
      recordCommit(
        upsertAnnotation(annotationsRef.current, annotation),
        "label",
        [id],
      );
      onLabelChangeProp?.(id, label, annotation);
    },
    [endEdit, onLabelChangeProp, recordCommit],
  );

  const registerFinish = useCallback((fn: (() => void) | null) => {
    finishImplRef.current = fn;
  }, []);

  const registerCommitTransform = useCallback(
    (fn: ((items: Annotation[]) => Annotation[]) | null) => {
      commitTransformRef.current = fn;
    },
    [],
  );

  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  useEffect(() => {
    if (!emitLiveChanges) return;
    return live.subscribe(() => {
      if (!live.isActive()) return;
      notifyRef.current(live.apply(annotationsRef.current), {
        reason: "live",
        cause: "edit",
        ids: [...liveIdsRef.current],
      });
    });
  }, [emitLiveChanges, live]);

  const finish = useCallback(() => {
    if (finishImplRef.current) {
      finishImplRef.current();
      return;
    }
    if (draftProp === undefined) setDraftState(null);
    onDraftChangeProp?.(null);
    if (toolProp === undefined) setToolState(IDLE_TOOL);
    onToolChangeProp?.(IDLE_TOOL);
  }, [draftProp, onDraftChangeProp, onToolChangeProp, toolProp]);

  const setLabel = useCallback(
    (id: string, label: string) => {
      // Land any in-flight gesture first so this reads current geometry.
      endEdit();
      const match = annotationsRef.current.find(
        (annotation) => annotation.id === id,
      );
      if (!match) return;
      onLabelChange(id, label, setAnnotationLabel(match, label));
    },
    [endEdit, onLabelChange],
  );

  const setColor = useCallback(
    (id: string, color: string) => {
      endEdit();
      const match = annotationsRef.current.find(
        (annotation) => annotation.id === id,
      );
      if (!match) return;
      const annotation = setAnnotationColor(match, color);
      recordCommit(
        upsertAnnotation(annotationsRef.current, annotation),
        "style",
        [id],
      );
      onColorChangeProp?.(id, color, annotation);
    },
    [endEdit, onColorChangeProp, recordCommit],
  );

  const setStyle = useCallback(
    (id: string, style: AnnotationStyle) => {
      endEdit();
      const match = annotationsRef.current.find(
        (annotation) => annotation.id === id,
      );
      if (!match) return;
      const annotation = setAnnotationStyle(match, style);
      recordCommit(
        upsertAnnotation(annotationsRef.current, annotation),
        "style",
        [id],
      );
    },
    [endEdit, recordCommit],
  );

  const removeSelected = useCallback(() => {
    endEdit();
    const ids = selectedIdsRef.current;
    const id = selectedIdRef.current;
    if (ids.length === 0 && !id) return;
    if (ids.length <= 1 && id) {
      const match = annotationsRef.current.find(
        (annotation) => annotation.id === id,
      );
      const vertexIndex = selectedVertexIndexRef.current;
      if (match && vertexIndex != null && canRemoveVertex(match, vertexIndex)) {
        const next = removeVertex(match, vertexIndex);
        endEdit();
        recordCommit(upsertAnnotation(annotationsRef.current, next), "edit", [
          id,
        ]);
        const vertices = editableVertices(next);
        setSelectedVertexIndexState(
          vertices.length === 0
            ? null
            : Math.min(vertexIndex, vertices.length - 1),
        );
        onUpdateProp?.(next);
        return;
      }
      onDelete(id);
      return;
    }
    endEdit();
    recordCommit(removeAnnotations(annotationsRef.current, ids), "delete", ids);
    for (const item of ids) onDeleteProp?.(item);
    applySelection([]);
  }, [
    applySelection,
    endEdit,
    onDelete,
    onDeleteProp,
    onUpdateProp,
    recordCommit,
  ]);

  const groupSelected = useCallback(() => {
    const ids = selectedIdsRef.current;
    if (!canGroupAnnotations(annotationsRef.current, ids)) return;
    endEdit();
    recordCommit(groupAnnotations(annotationsRef.current, ids), "group", ids);
    applySelection(expandGroupIds(annotationsRef.current, ids), false);
  }, [applySelection, endEdit, recordCommit]);

  const ungroupSelected = useCallback(() => {
    const ids = selectedIdsRef.current;
    if (!canUngroupAnnotations(annotationsRef.current, ids)) return;
    endEdit();
    recordCommit(
      ungroupAnnotations(annotationsRef.current, ids),
      "ungroup",
      ids,
    );
  }, [endEdit, recordCommit]);

  useEffect(() => {
    if (annotationsProp === undefined) return;
    // Our own echo, handed straight back by the host.
    if (annotationsProp === lastEmittedRef.current) return;
    // Never swap geometry out from under an in-flight gesture. The host gets
    // the authoritative array again on endEdit.
    if (editingRef.current) return;
    // A host that remaps annotations on the way in — through GeoJSON, a store,
    // a fetch — hands back a fresh array on the render right after a commit,
    // still carrying what we just replaced. Adopting it would undo the change.
    // Our commit stays authoritative until the host comes back carrying it.
    const committed = committedRef.current;
    const replaced = replacedRef.current;
    if (committed) {
      const disarm = () => {
        committedRef.current = undefined;
        replacedRef.current = undefined;
      };
      if (sameIds(annotationsProp, committed)) {
        // The same shapes in different places: a render the host's store has
        // not caught up with. Once the places agree the host is in step, and
        // from there its geometry is news rather than a stale render.
        if (!sameGeometry(annotationsProp, committed)) return;
        disarm();
      } else if (
        replaced &&
        sameIds(annotationsProp, replaced) &&
        sameGeometry(annotationsProp, replaced)
      ) {
        // The list exactly as it was before the commit: an add or a delete
        // the host has not applied yet.
        return;
      } else {
        // Neither our commit nor what it replaced. A load, a collaborator, an
        // edit the host made itself: it wins.
        disarm();
      }
    }
    if (annotationsEqual(annotationsProp, annotationsRef.current)) return;
    // A host remap (colour normalising, dropped fields, re-ordered keys) leaves
    // geometry alone, so adopt it without throwing away undo.
    const geometryChanged = !sameGeometry(
      annotationsProp,
      annotationsRef.current,
    );
    annotationsRef.current = annotationsProp;
    setAnnotationsState(cloneAnnotations(annotationsProp));
    if (geometryChanged) {
      pastRef.current = [];
      futureRef.current = [];
      setCanUndo(false);
      setCanRedo(false);
    }
  }, [annotationsProp]);

  const value = useMemo<AnnotateSession>(
    () => ({
      annotations,
      setAnnotations: replaceAnnotations,
      draft,
      setDraft,
      tool,
      setTool,
      selectedId,
      selectedIds,
      setSelectedId,
      setSelectedIds,
      selectedVertexIndex,
      setSelectedVertexIndex,
      setLabel,
      setColor,
      setStyle,
      fonts,
      defaultFontFamily,
      onAdd,
      onAddMany,
      onUpdate,
      onUpdateMany,
      onDelete,
      onDraftChange: setDraft,
      onToolChange: setTool,
      onSelect: setSelectedId,
      onLabelChange,
      canFinish: canPressFinish(tool, draft),
      finish,
      registerFinish,
      registerCommitTransform,
      beginEdit,
      endEdit,
      isEditing,
      undo,
      redo,
      canUndo,
      canRedo,
      removeSelected,
      groupSelected,
      ungroupSelected,
      canGroup: canGroupAnnotations(annotations, selectedIds),
      canUngroup: canUngroupAnnotations(annotations, selectedIds),
      showLabels,
      showArea,
      trace,
    }),
    [
      annotations,
      beginEdit,
      canRedo,
      canUndo,
      draft,
      endEdit,
      finish,
      fonts,
      defaultFontFamily,
      groupSelected,
      isEditing,
      onAdd,
      onAddMany,
      onDelete,
      onLabelChange,
      onUpdate,
      onUpdateMany,
      redo,
      registerCommitTransform,
      registerFinish,
      removeSelected,
      replaceAnnotations,
      selectedId,
      selectedIds,
      setSelectedIds,
      selectedVertexIndex,
      setDraft,
      setColor,
      setLabel,
      setStyle,
      setSelectedId,
      setSelectedVertexIndex,
      setTool,
      showArea,
      showLabels,
      trace,
      tool,
      ungroupSelected,
      undo,
    ],
  );

  return (
    <AnnotateContext.Provider value={value}>
      <LiveEditProvider store={live}>
        <AnnotateFontLoader fonts={fonts} />
        {children}
      </LiveEditProvider>
    </AnnotateContext.Provider>
  );
}

export function useAnnotate(): AnnotateSession {
  const session = useContext(AnnotateContext);
  if (!session) {
    throw new Error("useAnnotate must be used within AnnotateProvider");
  }
  return session;
}

export function useOptionalAnnotate(): AnnotateSession | null {
  return useContext(AnnotateContext);
}
