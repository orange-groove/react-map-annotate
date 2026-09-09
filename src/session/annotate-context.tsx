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
} from "./history";
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
  const [isEditing, setIsEditing] = useState(false);
  const liveIdsRef = useRef<Set<string>>(new Set());
  // The exact array last handed to onChange. A controlled host that passes it
  // straight back is echoing us, not supplying new truth.
  const lastEmittedRef = useRef<Annotation[] | undefined>(undefined);

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
    (next: Annotation[], meta: ChangeMeta) => {
      lastEmittedRef.current = next;
      onChange?.(next, meta);
      if (meta.reason === "commit") onCommit?.(next, meta);
    },
    [onChange, onCommit],
  );

  const commitAnnotations = useCallback(
    (next: Annotation[], meta: ChangeMeta) => {
      annotationsRef.current = next;
      setAnnotationsState(next);
      notify(next, meta);
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

  const beginEdit = useCallback(() => {
    if (editingRef.current) return;
    pushPast();
    editingRef.current = true;
    setIsEditing(true);
    syncHistoryFlags();
  }, [pushPast, syncHistoryFlags]);

  const endEdit = useCallback(() => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setIsEditing(false);
    const last = pastRef.current[pastRef.current.length - 1];
    if (last && annotationsEqual(last, annotationsRef.current)) {
      pastRef.current = pastRef.current.slice(0, -1);
    }
    syncHistoryFlags();
    const ids = [...liveIdsRef.current];
    liveIdsRef.current.clear();
    if (ids.length > 0) {
      notify(annotationsRef.current, {
        reason: "commit",
        cause: "edit",
        ids,
      });
    }
  }, [notify, syncHistoryFlags]);

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

  const onUpdate = useCallback(
    (annotation: Annotation) => {
      beginEdit();
      liveIdsRef.current.add(annotation.id);
      commitAnnotations(upsertAnnotation(annotationsRef.current, annotation), {
        reason: "live",
        cause: "edit",
        ids: [annotation.id],
      });
      onUpdateProp?.(annotation);
    },
    [beginEdit, commitAnnotations, onUpdateProp],
  );

  const onUpdateMany = useCallback(
    (items: Annotation[]) => {
      if (items.length === 0) return;
      beginEdit();
      const ids = items.map((item) => item.id);
      for (const id of ids) liveIdsRef.current.add(id);
      commitAnnotations(upsertAnnotations(annotationsRef.current, items), {
        reason: "live",
        cause: "edit",
        ids,
      });
      for (const item of items) onUpdateProp?.(item);
    },
    [beginEdit, commitAnnotations, onUpdateProp],
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
      const match = annotationsRef.current.find(
        (annotation) => annotation.id === id,
      );
      if (!match) return;
      onLabelChange(id, label, setAnnotationLabel(match, label));
    },
    [onLabelChange],
  );

  const setColor = useCallback(
    (id: string, color: string) => {
      const match = annotationsRef.current.find(
        (annotation) => annotation.id === id,
      );
      if (!match) return;
      const annotation = setAnnotationColor(match, color);
      endEdit();
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
      const match = annotationsRef.current.find(
        (annotation) => annotation.id === id,
      );
      if (!match) return;
      const annotation = setAnnotationStyle(match, style);
      endEdit();
      recordCommit(
        upsertAnnotation(annotationsRef.current, annotation),
        "style",
        [id],
      );
    },
    [endEdit, recordCommit],
  );

  const removeSelected = useCallback(() => {
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
      <AnnotateFontLoader fonts={fonts} />
      {children}
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
