// Minimal synchronous observables — framework-free (React reads them with
// useSyncExternalStore; tests read them directly).

export type Listener<T> = (value: T) => void;
export type Subscribe<T> = (listener: Listener<T>) => () => void;

/** A stream of events delivered synchronously to every current listener. */
export class Emitter<T> {
  private readonly listeners = new Set<Listener<T>>();

  readonly subscribe: Subscribe<T> = (l) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  emit(value: T): void {
    for (const l of [...this.listeners]) l(value);
  }

  clear(): void {
    this.listeners.clear();
  }
}

/** A current value + change notifications (Flutter's ValueNotifier). */
export class Observable<T> {
  private readonly changes = new Emitter<T>();
  private disposed = false;

  constructor(private current: T) {}

  get value(): T {
    return this.current;
  }

  set value(v: T) {
    if (this.disposed || Object.is(v, this.current)) return;
    this.current = v;
    this.changes.emit(v);
  }

  readonly subscribe: Subscribe<T> = (l) => this.changes.subscribe(l);

  dispose(): void {
    this.disposed = true;
    this.changes.clear();
  }
}
