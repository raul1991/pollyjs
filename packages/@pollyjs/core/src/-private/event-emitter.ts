import { assert } from '@pollyjs/utils';
import isObjectLike from 'lodash-es/isObjectLike';

interface ListenerFn {
  (...args: any[]): any; // TODO make this more precise
}

const EVENTS = Symbol();
const EVENT_NAMES = Symbol();

function assertEventName(eventName: string, eventNames: Set<string>): void {
  assert(
    `Invalid event name provided. Expected string, received: "${typeof eventName}".`,
    typeof eventName === 'string'
  );

  assert(
    `Invalid event name provided: "${eventName}". Possible events: ${[
      ...eventNames
    ].join(', ')}.`,
    eventNames.has(eventName)
  );
}

function assertListener(listener: Function) {
  assert(
    `Invalid listener provided. Expected function, received: "${typeof listener}".`,
    typeof listener === 'function'
  );
}

export default class EventEmitter {
  private [EVENTS]: Map<string, Set<Function>>;
  private [EVENT_NAMES]: Set<string>;

  constructor({ eventNames = <string[]>[] }) {
    assert(
      'An array of supported events must be provided via the `eventNames` option.',
      eventNames && eventNames.length > 0
    );

    this[EVENTS] = new Map();
    this[EVENT_NAMES] = new Set(eventNames);
  }

  /**
   * Returns an array listing the events for which the emitter has
   * registered listeners
   */
  public eventNames(): string[] {
    const eventNames = [] as string[];

    this[EVENTS].forEach(
      (_, eventName) =>
        this.hasListeners(eventName) && eventNames.push(eventName)
    );

    return eventNames;
  }

  /**
   * Adds the `listener` function to the end of the listeners array for the
   * event named `eventName`
   */
  public on(eventName: string, listener: ListenerFn): this {
    assertEventName(eventName, this[EVENT_NAMES]);
    assertListener(listener);

    const events = this[EVENTS];

    if (!events.has(eventName)) {
      events.set(eventName, new Set());
    }

    events.get(eventName).add(listener);

    return this;
  }

  /**
   * Adds a one-time `listener` function for the event named `eventName`.
   * The next time `eventName` is triggered, this listener is removed and
   * then invoked.
   */
  public once(eventName: string, listener: ListenerFn): this {
    assertEventName(eventName, this[EVENT_NAMES]);
    assertListener(listener);

    const once = (...args: any[]) => {
      this.off(eventName, once);

      return listener(...args);
    };

    this.on(eventName, once);

    return this;
  }

  /**
   * Removes the specified `listener` from the listener array for
   * the event named `eventName`. If `listener` is not provided then it removes
   * all listeners, or those of the specified `eventName`.
   */
  public off(eventName: string, listener: ListenerFn): this {
    assertEventName(eventName, this[EVENT_NAMES]);

    const events = this[EVENTS];

    if (this.hasListeners(eventName)) {
      if (typeof listener === 'function') {
        events.get(eventName).delete(listener);
      } else {
        events.get(eventName).clear();
      }
    }

    return this;
  }

  /**
   * Returns a copy of the array of listeners for the event named `eventName`.
   */
  public listeners(eventName: string): Function[] {
    assertEventName(eventName, this[EVENT_NAMES]);

    return this.hasListeners(eventName) ? [...this[EVENTS].get(eventName)] : [];
  }

  /**
   * Returns `true` if there are any listeners for the event named `eventName`
   * or `false` otherwise.
   */
  public hasListeners(eventName: string): boolean {
    assertEventName(eventName, this[EVENT_NAMES]);

    const events = this[EVENTS];

    return events.has(eventName) && events.get(eventName).size > 0;
  }

  /**
   * Asynchronously calls each of the `listeners` registered for the event named
   * `eventName`, in the order they were registered, passing the supplied
   * arguments to each.
   *
   * Returns a promise that will resolve to `true` if the event had listeners,
   * `false` otherwise.
   */
  public async emit(eventName: string, ...args: any[]): Promise<boolean> {
    assertEventName(eventName, this[EVENT_NAMES]);

    if (this.hasListeners(eventName)) {
      for (const listener of this.listeners(eventName)) {
        await listener(...args);
      }

      return true;
    }

    return false;
  }

  /**
   * Asynchronously and concurrently calls each of the `listeners` registered
   * for the event named `eventName`, in the order they were registered,
   * passing the supplied arguments to each.
   *
   * Returns a promise that will resolve to `true` if the event had listeners,
   * `false` otherwise.
   */
  public async emitParallel(eventName: string, ...args: any[]): Promise<boolean> {
    assertEventName(eventName, this[EVENT_NAMES]);

    if (this.hasListeners(eventName)) {
      await Promise.all(
        this.listeners(eventName).map(listener => listener(...args))
      );

      return true;
    }

    return false;
  }

  /**
   * Synchronously calls each of the `listeners` registered for the event named
   * `eventName`, in the order they were registered, passing the supplied
   * arguments to each.
   *
   * Throws if a listener's return value is promise-like.
   *
   * Returns `true` if the event had listeners, `false` otherwise.
   */
  public emitSync(eventName: string, ...args: any[]): boolean {
    assertEventName(eventName, this[EVENT_NAMES]);

    if (this.hasListeners(eventName)) {
      this.listeners(eventName).forEach(listener => {
        const returnValue = listener(...args);

        assert(
          `Attempted to emit a synchronous event "${eventName}" but an asynchronous listener was called.`,
          !(isObjectLike(returnValue) && typeof returnValue.then === 'function')
        );
      });

      return true;
    }

    return false;
  }
}
