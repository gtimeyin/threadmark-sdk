import assert from "node:assert/strict";
import test from "node:test";

import { describeFeatures, featureReportMessage } from "../src/featureReport.js";

test("with no backend, nothing that involves people is on, and the message says comments vanish on reload", () => {
  const { on, off } = describeFeatures({});
  assert.deepEqual(on, []);
  assert.equal(off[0].name, "Comments that last");
  assert.match(featureReportMessage({}), /On: none\.[\s\S]*Comments that last: annotations \+ onFeedbackCreate \(comments vanish on reload/);
});

test("what a host passes switches features on, and only the rest are listed as off", () => {
  const props = { annotations: [], onFeedbackCreate() {}, onPollVote() {}, notifications: [], nextSteps: { steps: [] }, onAiReview() {} };
  const { on, off } = describeFeatures(props);
  assert.deepEqual(on, ["Comments that last", "Polls", "Inbox", "Next steps", "AI review"]);
  assert.ok(!off.some((item) => on.includes(item.name)));
  assert.match(featureReportMessage(props), /^\[threadmark\] Capture works on its own\. People features need your backend or Threadmark Cloud \(@threadmark\/cloud\)\.\nOn: Comments that last, Polls, Inbox, Next steps, AI review\./);
});
