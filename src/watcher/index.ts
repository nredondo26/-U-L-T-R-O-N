import * as fs from 'fs';
import * as path from 'path';
import { log } from '../shared/logger';

export type FileChangeCallback = (event: 'add' | 'change' | 'unlink', filePath: string) => void;

export interface WatcherOptions {
  watchDirs: string[];
  watchExtensions: string[];
  debounceMs: number;
  onFileChange?: FileChangeCallback;
}

export class FileWatcher {
  private watchers: fs.FSWatcher[] = [];
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private options: WatcherOptions;
  private running = false;

  constructor(options: WatcherOptions) {
    this.options = options;
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    for (const dir of this.options.watchDirs) {
      const fullPath = path.resolve(dir);
      if (!fs.existsSync(fullPath)) {
        log.warn('FileWatcher: directory not found', { dir: fullPath });
        continue;
      }
      this.watchDirectory(fullPath);
    }

    log.info('FileWatcher started', { dirs: this.options.watchDirs });
  }

  stop(): void {
    for (const w of this.watchers) {
      w.close();
    }
    this.watchers = [];
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.running = false;
    log.info('FileWatcher stopped');
  }

  addDirectory(dir: string): void {
    const fullPath = path.resolve(dir);
    if (!fs.existsSync(fullPath)) {
      log.warn('FileWatcher: directory not found', { dir: fullPath });
      return;
    }
    this.watchDirectory(fullPath);
  }

  private watchDirectory(dir: string): void {
    try {
      const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        const fullPath = path.join(dir, filename);

        const ext = path.extname(filename).toLowerCase();
        if (!this.options.watchExtensions.includes(ext)) return;

        const relativePath = path.relative(process.cwd(), fullPath);

        this.debounce(relativePath, () => {
          const event = eventType === 'rename'
            ? (fs.existsSync(fullPath) ? 'add' : 'unlink')
            : 'change';

          log.info('FileWatcher: change detected', { event, file: relativePath });
          this.options.onFileChange?.(event, relativePath);
        });
      });

      this.watchers.push(watcher);
    } catch (e) {
      log.warn('FileWatcher: failed to watch directory', { dir, error: String(e) });
    }
  }

  private debounce(key: string, fn: () => void): void {
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      fn();
    }, this.options.debounceMs);

    this.debounceTimers.set(key, timer);
  }

  isRunning(): boolean {
    return this.running;
  }
}
