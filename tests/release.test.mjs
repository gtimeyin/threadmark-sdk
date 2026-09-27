import assert from "node:assert/strict";
import test from "node:test";
import { validateRelease } from "../scripts/check-release.mjs";

function release(overrides = {}) {
  return {
    metadata: {
      name: "threadmark-react",
      version: "0.1.0-beta.9",
      repository: { url: "git+https://github.com/gtimeyin/threadmark-sdk.git" },
      publishConfig: { access: "public", tag: "beta", provenance: true },
    },
    tag: "v0.1.0-beta.9",
    refType: "tag",
    repository: "gtimeyin/threadmark-sdk",
    isPrivate: "false",
    npmVersion: "11.5.1",
    ...overrides,
  };
}

test("accepts a matching beta tag from the public source with supported npm", () => {
  for (const npmVersion of ["11.5.1", "11.12.1", "12.0.0"]) {
    assert.equal(validateRelease(release({ npmVersion })), "0.1.0-beta.9");
  }
});

test("rejects private or unknown source visibility", () => {
  for (const isPrivate of ["true", undefined, ""]) {
    assert.throws(() => validateRelease(release({ isPrivate })), /public source repository/);
  }
});

test("rejects releases from forks", () => {
  for (const repository of ["someone/threadmark", "gtimeyin/threadmark"]) {
    assert.throws(() => validateRelease(release({ repository })), /not a fork/);
  }
});

test("rejects mismatched tags and branch refs", () => {
  assert.throws(() => validateRelease(release({ tag: "v0.1.0-beta.7" })), /exactly match/);
  assert.throws(() => validateRelease(release({ refType: "branch" })), /exactly match/);
});

test("does not silently promote stable releases or another prerelease channel", () => {
  for (const version of ["0.1.0", "0.1.0-rc.1", "0.1.0-beta"]) {
    const input = release();
    input.metadata.version = version;
    assert.throws(() => validateRelease(input), /only publishes beta/);
  }
});

test("rejects the root workspace and private packages", () => {
  for (const fields of [{ name: "review-tool" }, { private: true }]) {
    const input = release();
    Object.assign(input.metadata, fields);
    assert.throws(() => validateRelease(input), /Only the public threadmark-react/);
  }
});

test("requires matching repository metadata", () => {
  const input = release();
  input.metadata.repository.url = "git+https://github.com/someone/threadmark.git";
  assert.throws(() => validateRelease(input), /repository metadata/);
});

test("rejects disabled provenance or unintended distribution settings", () => {
  for (const fields of [{ provenance: false }, { tag: "latest" }, { access: "restricted" }]) {
    const input = release();
    Object.assign(input.metadata.publishConfig, fields);
    assert.throws(() => validateRelease(input), /must remain enabled/);
  }
});

test("rejects unsupported or unknown npm versions", () => {
  for (const npmVersion of ["10.9.3", "11.4.9", "11.5.0", undefined, "not-a-version"]) {
    assert.throws(() => validateRelease(release({ npmVersion })), /npm 11.5.1/);
  }
});
