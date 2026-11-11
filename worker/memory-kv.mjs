// In-memory stand-in for a Cloudflare KV namespace, for tests and local development.
export function memoryKV() {
  const store = new Map();
  return {
    async get(key, type) {
      const v = store.get(key)?.value ?? null;
      return v && type === 'json' ? JSON.parse(v) : v;
    },
    async getWithMetadata(key) {
      const e = store.get(key);
      return { value: e?.value ?? null, metadata: e?.metadata ?? null };
    },
    async put(key, value, opts = {}) {
      store.set(key, { value, metadata: opts.metadata ?? null });
    },
    async delete(key) {
      store.delete(key);
    },
    async list({ prefix }) {
      const keys = [...store].filter(([k]) => k.startsWith(prefix)).map(([name, e]) => ({ name, metadata: e.metadata }));
      return { keys, list_complete: true };
    },
  };
}
