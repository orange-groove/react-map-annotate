"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type {
  AnnotateCallbacks,
  Annotation,
  AnnotateTool,
  DraftAnnotation,
} from "../types";
import {
  canPressFinish,
  removeAnnotation,
  setAnnotationColor,
  setAnnotationLabel,
  upsertAnnotation,
} from "../utils/annotations";

export interface AnnotateSession {
  annotations: Annotation[];
  setAnnotations: Dispatch<SetStateAction<Annotation[]>>;
  draft: DraftAnnotation | null;
  setDraft: (draft: DraftAnnotation | null) => void;
  tool: AnnotateTool;
  setTool: (tool: AnnotateTool) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  setLabel: (id: string, label: string) => void;
  setColor: (id: string, color: string) => void;
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
}: AnnotateProviderProps) {
  const [annotationsState, setAnnotationsState] =
    useState<Annotation[]>(initialAnnotations);
  const [draftState, setDraftState] = useState<DraftAnnotation | null>(null);
  const [toolState, setToolState] = useState<AnnotateTool>(initialTool);
  const [selectedIdState, setSelectedIdState] = useState<string | null>(null);
  const finishImplRef = useRef<(() => void) | null>(null);

  const annotations = annotationsProp ?? annotationsState;
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  const draft = draftProp ?? draftState;
  const tool = toolProp ?? toolState;
  const selectedId = selectedIdProp ?? selectedIdState;

  const commitAnnotations = useCallback(
    (next: Annotation[]) => {
      annotationsRef.current = next;
      if (annotationsProp === undefined) {
        setAnnotationsState(next);
      }
      onChange?.(next);
    },
    [annotationsProp, onChange],
  );

  const replaceAnnotations = useCallback<
    Dispatch<SetStateAction<Annotation[]>>
  >(
    (action) => {
      const next =
        typeof action === "function" ? action(annotationsRef.current) : action;
      commitAnnotations(next);
    },
    [commitAnnotations],
  );

  const onAdd = useCallback(
    (annotation: Annotation) => {
      commitAnnotations(upsertAnnotation(annotationsRef.current, annotation));
      setSelectedIdState(annotation.id);
      setDraftState(null);
      onAddProp?.(annotation);
    },
    [commitAnnotations, onAddProp],
  );

  const onUpdate = useCallback(
    (annotation: Annotation) => {
      commitAnnotations(upsertAnnotation(annotationsRef.current, annotation));
      onUpdateProp?.(annotation);
    },
    [commitAnnotations, onUpdateProp],
  );

  const onDelete = useCallback(
    (id: string) => {
      commitAnnotations(removeAnnotation(annotationsRef.current, id));
      setSelectedIdState((current) => (current === id ? null : current));
      onDeleteProp?.(id);
    },
    [commitAnnotations, onDeleteProp],
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
      if (selectedIdProp === undefined) setSelectedIdState(id);
      onSelectProp?.(id);
    },
    [onSelectProp, selectedIdProp],
  );

  const onLabelChange = useCallback(
    (id: string, label: string, annotation: Annotation) => {
      commitAnnotations(upsertAnnotation(annotationsRef.current, annotation));
      onLabelChangeProp?.(id, label, annotation);
    },
    [commitAnnotations, onLabelChangeProp],
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
      commitAnnotations(upsertAnnotation(annotationsRef.current, annotation));
      onColorChangeProp?.(id, color, annotation);
    },
    [commitAnnotations, onColorChangeProp],
  );

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
      setLabel,
      setColor,
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
    }),
    [
      annotations,
      draft,
      finish,
      onAdd,
      onDelete,
      onLabelChange,
      onUpdate,
      registerFinish,
      replaceAnnotations,
      selectedId,
      setDraft,
      setColor,
      setLabel,
      setSelectedId,
      setTool,
      tool,
    ],
  );

  return (
    <AnnotateContext.Provider value={value}>
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
