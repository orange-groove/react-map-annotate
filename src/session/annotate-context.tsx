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
  DraftAnnotation,
  TraceOption,
} from "../core/types";
import {
  canPressFinish,
  removeAnnotation,
  setAnnotationColor,
  setAnnotationLabel,
  setAnnotationStyle,
  upsertAnnotation,
} from "../core/utils/annotations";
import {
  canRemoveVertex,
  editableVertices,
  removeVertex,
} from "../core/utils/edit";
import { HISTORY_LIMIT, annotationsEqual, cloneAnnotations } from "./history";
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
  setSelectedId: (id: string | null) => void;
  selectedVertexIndex: number | null;
  setSelectedVertexIndex: (index: number | null) => void;
  setLabel: (id: string, label: string) => void;
  setColor: (id: string, color: string) => void;
  setStyle: (id: string, style: AnnotationStyle) => void;
  fonts: AnnotateFont[];
  defaultFontFamily?: string;
  onAdd: (annotation: Annotation) => void;
  onUpdate: (annotation: Annotation) => void;
  onDelete: (id: string) => void;
  onDraftChange: (draft: DraftAnnotation | null) => void;
  onToolChange: (tool: AnnotateTool) => void;
  onSelect: (id: string | null) => void;
  onLabelChange: (id: string, label: string, annotation: Annotation) => void;
  canFinish: boolean;
  finish: () => void;
  registerFinish: (fn: (() => void) | null) => void;
  beginEdit: () => void;
  endEdit: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  removeSelected: () => void;
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
  onChange?: (annotations: Annotation[]) => void;
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
  initialTool = "select",
  annotations: annotationsProp,
  draft: draftProp,
  tool: toolProp,
  selectedId: selectedIdProp,
  onChange,
  onAdd: onAddProp,
  onUpdate: onUpdateProp,
  onDelete: onDeleteProp,
  onDraftChange: onDraftChangeProp,
  onToolChange: onToolChangeProp,
  onSelect: onSelectProp,
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
  const lastCommittedRef = useRef<Annotation[] | undefined>(undefined);
  const internalCommitRef = useRef(false);

  const annotations = annotationsState;
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotationsState;
  const selectedIdRef = useRef(selectedIdProp ?? selectedIdState);
  const selectedVertexIndexRef = useRef<number | null>(null);
  const draft = draftProp ?? draftState;
  const tool = toolProp ?? toolState;
  const selectedId = selectedIdProp ?? selectedIdState;
  selectedIdRef.current = selectedId;
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

  const commitAnnotations = useCallback(
    (next: Annotation[]) => {
      annotationsRef.current = next;
      lastCommittedRef.current = next;
      internalCommitRef.current = true;
      setAnnotationsState(next);
      onChange?.(next);
    },
    [onChange],
  );

  const recordCommit = useCallback(
    (next: Annotation[]) => {
      if (annotationsEqual(annotationsRef.current, next)) return;
      if (!editingRef.current) pushPast();
      commitAnnotations(next);
      syncHistoryFlags();
    },
    [commitAnnotations, pushPast, syncHistoryFlags],
  );

  const beginEdit = useCallback(() => {
    if (editingRef.current) return;
    pushPast();
    editingRef.current = true;
    syncHistoryFlags();
  }, [pushPast, syncHistoryFlags]);

  const endEdit = useCallback(() => {
    if (!editingRef.current) return;
    editingRef.current = false;
    const last = pastRef.current[pastRef.current.length - 1];
    if (last && annotationsEqual(last, annotationsRef.current)) {
      pastRef.current = pastRef.current.slice(0, -1);
    }
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  const undo = useCallback(() => {
    if (editingRef.current) endEdit();
    const previous = pastRef.current[pastRef.current.length - 1];
    if (!previous) return;
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [
      ...futureRef.current,
      cloneAnnotations(annotationsRef.current),
    ];
    commitAnnotations(cloneAnnotations(previous));
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
    commitAnnotations(cloneAnnotations(next));
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
      recordCommit(next);
    },
    [recordCommit],
  );

  const onAdd = useCallback(
    (annotation: Annotation) => {
      endEdit();
      recordCommit(upsertAnnotation(annotationsRef.current, annotation));
      setSelectedIdState(annotation.id);
      selectedIdRef.current = annotation.id;
      selectedVertexIndexRef.current = null;
      setSelectedVertexIndexState(null);
      setDraftState(null);
      onAddProp?.(annotation);
    },
    [endEdit, onAddProp, recordCommit],
  );

  const onUpdate = useCallback(
    (annotation: Annotation) => {
      beginEdit();
      commitAnnotations(upsertAnnotation(annotationsRef.current, annotation));
      onUpdateProp?.(annotation);
    },
    [beginEdit, commitAnnotations, onUpdateProp],
  );

  const onDelete = useCallback(
    (id: string) => {
      endEdit();
      recordCommit(removeAnnotation(annotationsRef.current, id));
      setSelectedIdState((current) => (current === id ? null : current));
      if (selectedIdRef.current === id) selectedIdRef.current = null;
      selectedVertexIndexRef.current = null;
      setSelectedVertexIndexState(null);
      onDeleteProp?.(id);
    },
    [endEdit, onDeleteProp, recordCommit],
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
    (id: string | null) => {
      if (id !== selectedIdRef.current) {
        selectedVertexIndexRef.current = null;
        setSelectedVertexIndexState(null);
      }
      selectedIdRef.current = id;
      if (selectedIdProp === undefined) setSelectedIdState(id);
      onSelectProp?.(id);
    },
    [onSelectProp, selectedIdProp],
  );

  const setSelectedVertexIndex = useCallback((index: number | null) => {
    selectedVertexIndexRef.current = index;
    setSelectedVertexIndexState(index);
  }, []);

  const onLabelChange = useCallback(
    (id: string, label: string, annotation: Annotation) => {
      endEdit();
      recordCommit(upsertAnnotation(annotationsRef.current, annotation));
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
    if (toolProp === undefined) setToolState("select");
    onToolChangeProp?.("select");
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
      recordCommit(upsertAnnotation(annotationsRef.current, annotation));
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
      recordCommit(upsertAnnotation(annotationsRef.current, annotation));
    },
    [endEdit, recordCommit],
  );

  const removeSelected = useCallback(() => {
    const id = selectedIdRef.current;
    if (!id) return;
    const match = annotationsRef.current.find(
      (annotation) => annotation.id === id,
    );
    const vertexIndex = selectedVertexIndexRef.current;
    if (match && vertexIndex != null && canRemoveVertex(match, vertexIndex)) {
      const next = removeVertex(match, vertexIndex);
      endEdit();
      recordCommit(upsertAnnotation(annotationsRef.current, next));
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
  }, [endEdit, onDelete, onUpdateProp, recordCommit]);

  useEffect(() => {
    if (annotationsProp === undefined) return;
    if (internalCommitRef.current) {
      internalCommitRef.current = false;
      lastCommittedRef.current = annotationsProp;
      return;
    }
    if (annotationsEqual(annotationsProp, annotationsRef.current)) {
      lastCommittedRef.current = annotationsProp;
      return;
    }
    annotationsRef.current = annotationsProp;
    setAnnotationsState(cloneAnnotations(annotationsProp));
    pastRef.current = [];
    futureRef.current = [];
    editingRef.current = false;
    lastCommittedRef.current = annotationsProp;
    setCanUndo(false);
    setCanRedo(false);
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
      setSelectedId,
      selectedVertexIndex,
      setSelectedVertexIndex,
      setLabel,
      setColor,
      setStyle,
      fonts,
      defaultFontFamily,
      onAdd,
      onUpdate,
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
      undo,
      redo,
      canUndo,
      canRedo,
      removeSelected,
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
      onAdd,
      onDelete,
      onLabelChange,
      onUpdate,
      redo,
      registerFinish,
      removeSelected,
      replaceAnnotations,
      selectedId,
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
