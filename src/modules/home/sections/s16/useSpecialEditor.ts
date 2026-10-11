'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SPECIAL_MAX_LENGTH } from './data';

export type EditStatus = 'draft' | 'selecting' | 'typing' | 'publishing' | 'published';

export interface EditState {
  /** What the site's announcement bar shows. */
  published: string;
  /** What the admin field holds. */
  draft: string;
  status: EditStatus;
}

export interface SpecialEditor {
  edit: EditState;
  onDraft: (value: string) => void;
  onTakeOver: () => void;
  onPublish: () => void;
}

const SELECT_AT_MS = 650;
const TYPE_AT_MS = 1250;
const TYPE_EVERY_MS = 42;
const PUBLISH_AFTER_TYPING_MS = 450;
const PUBLISHING_MS = 700;

/**
 * The admin step's one editable field. While the step is on screen the
 * autopilot selects the old special, types the new one and publishes it
 * (once per mount); a tap or focus in the field hands it to the visitor,
 * who can type their own and publish it to the site. Reduced motion opens
 * on the published result, still editable.
 */
export function useSpecialEditor(isActive: boolean, isReduced: boolean, before: string, after: string): SpecialEditor {
  const initialEdit = useMemo<EditState>(() => ({ published: before, draft: before, status: 'draft' }), [before]);
  const finalEdit = useMemo<EditState>(() => ({ published: after, draft: after, status: 'published' }), [after]);
  const [edit, setEdit] = useState<EditState>(initialEdit);
  const [isUser, setIsUser] = useState(false);
  const [isAutoDone, setIsAutoDone] = useState(false);
  const publishTimerRef = useRef(0);
  /** Set in the visitor's own handlers, before React re-renders (read by the autopilot's cleanup). */
  const isUserRef = useRef(false);

  useEffect(() => {
    if (!isActive || isUser || isAutoDone) return;
    const timers: number[] = [];
    const at = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));
    const finish = () => {
      setEdit(finalEdit);
      setIsAutoDone(true);
    };
    if (isReduced) {
      at(0, finish);
      return () => timers.forEach(id => window.clearTimeout(id));
    }
    const target = after;
    at(0, () => setEdit(initialEdit));
    at(SELECT_AT_MS, () => setEdit(prev => ({ ...prev, status: 'selecting' })));
    for (let count = 0; count <= target.length; count++) {
      at(TYPE_AT_MS + count * TYPE_EVERY_MS, () => setEdit(prev => ({ ...prev, draft: target.slice(0, count), status: 'typing' })));
    }
    const typedAt = TYPE_AT_MS + target.length * TYPE_EVERY_MS + PUBLISH_AFTER_TYPING_MS;
    at(typedAt, () => setEdit(prev => ({ ...prev, status: 'publishing' })));
    at(typedAt + PUBLISHING_MS, finish);
    return () => {
      timers.forEach(id => window.clearTimeout(id));
      // Scrolled on before the autopilot published: publish now, so the
      // later steps show the new special. A visitor's takeover keeps theirs.
      if (!isUserRef.current) finish();
    };
  }, [isActive, isUser, isAutoDone, isReduced, initialEdit, finalEdit, after]);

  useEffect(() => () => window.clearTimeout(publishTimerRef.current), []);

  const onTakeOver = useCallback(() => {
    isUserRef.current = true;
    setIsUser(true);
    setEdit(prev => (prev.status === 'selecting' || prev.status === 'typing' ? { ...prev, status: 'draft' } : prev));
  }, []);

  const onDraft = useCallback((value: string) => {
    isUserRef.current = true;
    setIsUser(true);
    setEdit(prev => ({ ...prev, draft: value.slice(0, SPECIAL_MAX_LENGTH), status: 'draft' }));
  }, []);

  const onPublish = useCallback(() => {
    isUserRef.current = true;
    setIsUser(true);
    window.clearTimeout(publishTimerRef.current);
    setEdit(prev => ({ ...prev, status: 'publishing' }));
    publishTimerRef.current = window.setTimeout(
      () => setEdit(prev => ({ ...prev, published: prev.draft.trim() || before, status: 'published' })),
      isReduced ? 0 : PUBLISHING_MS
    );
  }, [isReduced, before]);

  return useMemo(() => ({ edit, onDraft, onTakeOver, onPublish }), [edit, onDraft, onTakeOver, onPublish]);
}
