declare global {
  interface Map<K, V> {
    getOrInsertComputed(key: K, callbackfn: (key: K) => V): V
  }
}

if (typeof Map.prototype.getOrInsertComputed !== 'function') {
  Map.prototype.getOrInsertComputed = function <K, V>(
    this: Map<K, V>,
    key: K,
    callbackfn: (key: K) => V,
  ): V {
    if (this.has(key)) return this.get(key) as V
    const value = callbackfn(key)
    this.set(key, value)
    return value
  }
}

export {}
