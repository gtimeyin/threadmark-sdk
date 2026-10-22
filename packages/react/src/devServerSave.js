// Client half of threadmark-react/vite. Pass it as <Threadmark onTourSave={saveTourToDevServer} /> while the
// plugin is installed; it only sends a request when Tour mode's "Save to code" is pressed.

const TOUR_SAVE_PATH = "/__threadmark/tours/save";

/**
 * Sends a tour to the Vite plugin, which writes it into the project. Resolves `{ ok, path }` with the
 * project-relative file it wrote; rejects with the plugin's explanation when it refuses.
 */
export async function saveTourToDevServer(tour, file, { endpoint = TOUR_SAVE_PATH } = {}) {
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-threadmark-tours": "1" },
      body: JSON.stringify({ fileName: file.fileName, contents: file.contents }),
    });
  } catch {
    throw new Error("The dev server didn’t answer. Is the threadmark-react/vite plugin installed?");
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error || (response.status === 404
      ? "The dev server has no tour endpoint. Add threadmarkTours() from threadmark-react/vite to vite.config."
      : `Saving the tour failed (${response.status}).`));
  }
  return result;
}
