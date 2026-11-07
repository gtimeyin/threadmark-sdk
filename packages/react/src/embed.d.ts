import type { ThreadmarkProps } from "./index.js";

export type ThreadmarkMountOptions = ThreadmarkProps;

export interface ThreadmarkInstance {
  /** Replaces the given options; options you leave out keep their current values. */
  update(options: Partial<ThreadmarkMountOptions>): void;
  /** Removes the overlay and frees the page for another `mount()`. */
  unmount(): void;
}

/**
 * Mounts Threadmark on any page, without the host app using React. Takes the same options as the
 * `<Threadmark>` component. Only one instance runs per page: calling `mount()` again while one is
 * mounted updates its options and returns the same instance.
 */
export declare function mount(options: ThreadmarkMountOptions): ThreadmarkInstance;

/** Removes the mounted overlay, if any. */
export declare function unmount(): void;
