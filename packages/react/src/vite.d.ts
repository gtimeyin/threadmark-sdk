/**
 * threadmark-react/vite: lets Tour mode's "Save to code" write tour files while the Vite dev server runs.
 * Development only; production builds never include the endpoint.
 *
 * ```js
 * // vite.config.js
 * import { threadmarkTours } from "threadmark-react/vite";
 * export default defineConfig({ plugins: [react(), threadmarkTours()] });
 * ```
 *
 * Then pass `saveTourToDevServer` from "threadmark-react" as `<Threadmark onTourSave>`.
 */

export interface ThreadmarkToursPluginOptions {
  /** Where new tours are written, relative to the project root. Existing tours are updated in place. Defaults to "tours". */
  dir?: string;
}

/** A Vite plugin (typed loosely so this package doesn't depend on Vite's types). */
export declare function threadmarkTours(options?: ThreadmarkToursPluginOptions): {
  name: "threadmark-tours";
  apply: "serve";
  configResolved(config: { root: string }): void;
  configureServer(server: unknown): void;
};

export declare const TOUR_SAVE_PATH: "/__threadmark/tours/save";
export declare const TOUR_SAVE_HEADER: "x-threadmark-tours";

/** Handles one save request without a server. Exposed for other dev servers and tests. */
export declare function saveTourRequest(request: {
  method: string;
  headers?: Record<string, string | string[] | undefined>;
  body: string;
  root: string;
  dir?: string;
}): Promise<{ status: number; body: { ok: boolean; path?: string; error?: string; errors?: Array<{ path: string; message: string }> } }>;
