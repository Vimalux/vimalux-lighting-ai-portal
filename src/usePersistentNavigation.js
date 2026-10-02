import { useCallback, useRef, useState } from "react";
import { navigationKey, readNavigation, writeNavigation } from "./navigationState.js";

export default function usePersistentNavigation({ ready, userId, projectId, allowedViews, initialView }) {
  const [selection, setSelection] = useState(null);
  const key = navigationKey(userId, projectId);
  let storage;
  try { storage = window.localStorage; } catch { /* Browser storage may be disabled. */ }
  // Read after the account, permissions and active project are known. Never save
  // the temporary customer screen rendered during authentication/hydration.
  const candidate = selection?.key === key ? selection.view : (!selection && allowedViews.has(initialView) ? initialView : readNavigation(storage, key, allowedViews));
  const view = ready && allowedViews.has(candidate) ? candidate : "customer";
  const context = useRef(null);
  context.current = { key, userId, ready, allowedViews, storage, view };
  const setView = useCallback((next, targetProjectId) => {
    const current = context.current;
    if (!current.ready) return;
    const value = typeof next === "function" ? next(current.view) : next;
    if (!current.allowedViews.has(value)) return;
    const targetKey = targetProjectId ? navigationKey(current.userId, targetProjectId) : current.key;
    writeNavigation(current.storage, targetKey, value, current.allowedViews);
    setSelection({ key: targetKey, view: value });
  }, []);
  return [view, setView];
}
