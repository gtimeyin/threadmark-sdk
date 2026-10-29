// Shared across bundles so authoring can find a player without importing the production player UI.
const REGISTRY = Symbol.for('threadmark.tours.activePlayer');
export const getMountedTourPlayer = () => typeof globalThis === 'undefined' ? null : globalThis[REGISTRY] || null;
export const setMountedTourPlayer = instance => { globalThis[REGISTRY] = instance; };
