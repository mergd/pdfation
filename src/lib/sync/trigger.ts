type Listener = () => void

const listeners = new Set<Listener>()

export const onSyncDirty = (listener: Listener): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const notifySyncDirty = (): void => {
  for (const listener of listeners) listener()
}
