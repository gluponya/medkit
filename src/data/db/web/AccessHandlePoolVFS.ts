// expo-sqlite's web worker takes its file system from here, not from its own
// wa-sqlite/AccessHandlePoolVFS (metro.config.js points it here): the same
// one, after the files are given somewhere to live.
//
// SQLite keeps its files in the origin private file system, and some web views
// have none (no navigator.storage, or no sync access to a file: Telegram on an
// older iPhone). Without it the worker does not start and the app stops on its
// first screen. There the files are kept in memory instead: gone when the page
// closes, but in Telegram everything is on the server and comes down again.

// @ts-expect-error wa-sqlite is not typed
import { AccessHandlePoolVFS } from '../../../../node_modules/expo-sqlite/web/wa-sqlite/AccessHandlePoolVFS';

type Bytes = ArrayBufferView;

function view(buffer: Bytes): Uint8Array {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

class MemoryFile {
  readonly kind = 'file';
  bytes = new Uint8Array(0);
  size = 0;

  grow(size: number) {
    if (size <= this.bytes.length) return;
    const bytes = new Uint8Array(Math.max(size, this.bytes.length * 2));
    bytes.set(this.bytes.subarray(0, this.size));
    this.bytes = bytes;
  }

  async createSyncAccessHandle() {
    return new MemoryAccessHandle(this);
  }
}

class MemoryAccessHandle {
  constructor(private file: MemoryFile) {}

  read(buffer: Bytes, { at = 0 } = {}): number {
    const into = view(buffer);
    const n = Math.max(0, Math.min(into.length, this.file.size - at));
    into.set(this.file.bytes.subarray(at, at + n));
    return n;
  }

  write(buffer: Bytes, { at = 0 } = {}): number {
    const from = view(buffer);
    this.file.grow(at + from.length);
    this.file.bytes.set(from, at);
    this.file.size = Math.max(this.file.size, at + from.length);
    return from.length;
  }

  truncate(size: number) {
    this.file.grow(size);
    if (size < this.file.size) this.file.bytes.fill(0, size, this.file.size);
    this.file.size = size;
  }

  getSize(): number {
    return this.file.size;
  }

  flush() {}
  close() {}
}

function notFound(name: string) {
  return new DOMException(`${name} is not there`, 'NotFoundError');
}

class MemoryDirectory {
  readonly kind = 'directory';
  private entries = new Map<string, MemoryDirectory | MemoryFile>();

  async getDirectoryHandle(name: string, { create = false } = {}) {
    let entry = this.entries.get(name);
    if (!entry && create) this.entries.set(name, (entry = new MemoryDirectory()));
    if (!(entry instanceof MemoryDirectory)) throw notFound(name);
    return entry;
  }

  async getFileHandle(name: string, { create = false } = {}) {
    let entry = this.entries.get(name);
    if (!entry && create) this.entries.set(name, (entry = new MemoryFile()));
    if (!(entry instanceof MemoryFile)) throw notFound(name);
    return entry;
  }

  async removeEntry(name: string) {
    if (!this.entries.delete(name)) throw notFound(name);
  }

  async *[Symbol.asyncIterator]() {
    yield* this.entries.entries();
  }
}

function hasFileSystem(): boolean {
  const scope = self as unknown as { navigator: Navigator; FileSystemSyncAccessHandle?: unknown };
  return typeof scope.navigator.storage?.getDirectory === 'function' && scope.FileSystemSyncAccessHandle !== undefined;
}

if (!hasFileSystem()) {
  const root = new MemoryDirectory();
  Object.defineProperty(self.navigator, 'storage', {
    configurable: true,
    value: { getDirectory: async () => root },
  });
  console.warn('No private file system here: the database is kept in memory');
}

export { AccessHandlePoolVFS };
