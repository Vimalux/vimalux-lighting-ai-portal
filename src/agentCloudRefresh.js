// Agent data is server-owned. Refresh an open tab only after its local edits
// have finished saving, and never apply an older server snapshot over a newer
// local snapshot. This module deliberately does not access browser storage.

export function canRefreshAgentPortfolio({ syncState, pendingSaveCount = 0, observed, current, editing = false }) {
  return syncState === "saved"
    && pendingSaveCount === 0
    && !editing
    && observed === current;
}

const version = (item) => Number(item?.crm?.syncVersion || 0);
const time = (item) => Date.parse(item?.crm?.lastSyncedAt || "") || 0;

export function hasNewAgentCloudData(current = [], remote = []) {
  const local = new Map(current.map((item) => [item.id, item]));
  const incoming = new Map(remote.map((item) => [item.id, item]));
  let changed = local.size !== incoming.size;
  for (const item of remote) {
    const previous = local.get(item.id);
    if (!previous) { changed = true; continue; }
    if (version(item) < version(previous) || time(item) < time(previous)) return false;
    if (version(item) > version(previous) || time(item) > time(previous)) changed = true;
    if (item?.crm?.agentAccessMode !== previous?.crm?.agentAccessMode
      || item?.crm?.status !== previous?.crm?.status) changed = true;
  }
  return changed;
}
