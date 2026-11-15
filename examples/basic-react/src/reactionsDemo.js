/** Local fixture only. A production backend must authenticate the actor itself. */
export function createLocalReactionHandler({ store, reviewer, onRecords }) {
  return async (feedback, { messageId, emoji, active }) => {
    const records = await store.list();
    const record = records.find(item => item.feedback.id === feedback.id);
    if (!record) throw new Error("Discussion unavailable.");
    const message = messageId === feedback.id ? record.feedback : record.feedback.replies?.find(reply => reply.id === messageId);
    if (!message) throw new Error("Message unavailable.");
    const reactions = (message.reactions || []).filter(item => item.emoji !== emoji || item.reviewer.id !== reviewer.id);
    if (active) reactions.push({ emoji, reviewer });
    message.reactions = reactions;
    await store.upsert(record.feedback, record.context);
    onRecords(await store.list());
    return reactions;
  };
}
