import { useCallback, useRef, useState } from "react";
import { navigationKey, readNavigation, writeNavigation } from "./navigationState.js";

export default function usePersistentNavigation({ ready, userId, projectId, allowedViews }) {
  const [selection, setSelection] = useState(null);
  const key = navigationKey(userId, projectId);
  let storage;
  try { storage = window.localStorage; } catch { /* Browser storage may be disabled. */ }
  // Read after the account, permissions and active project are known. Never save
  // the temporary customer screen rendered during authentication/hydration.
  const candidate = selection?.key === key ? selection.view : readNavigation(storage, key, allowedViews);
  const view = ready && allowedViews.has(candidate) ? candidate : "customer";
  const context = useRef(null);
  context.current = { key, ready, allowedViews, storage, view };
  const setView = useCallback((next) => {
    const current = context.current;
    if (!current.ready) return;
    const value = typeof next === "function" ? next(current.view) : next;
    if (!current.allowedViews.has(value)) return;
    writeNavigation(current.storage, current.key, value, current.allowedViews);
    setSelection({ key: current.key, view: value });
  }, []);
  return [view, setView];
}
