const STORE_NAME = "annotations";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction was aborted."));
  });
}

export function createFeedbackStore({
  databaseName = "threadmark-review-fixture",
  projectKey,
  route = "/",
}) {
  const scope = `${projectKey}:${route}`;
  let databasePromise = null;

  const open = () => {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: "key" });
          store.createIndex("scope", "scope", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Threadmark storage could not open."));
    });
    return databasePromise;
  };

  return {
    async list() {
      const database = await open();
      const transaction = database.transaction(STORE_NAME, "readonly");
      const records = await requestResult(transaction.objectStore(STORE_NAME).getAll());
      await transactionDone(transaction);
      return records.filter((record) => record.feedback.projectKey === projectKey)
        .sort((left, right) => left.feedback.createdAt.localeCompare(right.feedback.createdAt))
        .map(({ feedback, context }) => ({ feedback, context }));
    },

    async upsert(feedback, context) {
      const database = await open();
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({
        key: `${projectKey}:${feedback.route}:${feedback.id}`,
        scope: `${projectKey}:${feedback.route}`,
        feedback,
        context: { evidence: [...(context?.evidence || [])] },
      });
      await transactionDone(transaction);
    },

    async remove(id) {
      const database = await open();
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const records = await requestResult(store.getAll());
      records.filter((record) => record.feedback.projectKey === projectKey && record.feedback.id === id)
        .forEach((record) => store.delete(record.key));
      await transactionDone(transaction);
    },

    async clear(ids) {
      const database = await open();
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const records = await requestResult(store.getAll());
      records.filter((record) => record.feedback.projectKey === projectKey &&
        (ids ? ids.includes(record.feedback.id) : record.scope === scope))
        .forEach((record) => store.delete(record.key));
      await transactionDone(transaction);
    },
  };
}
