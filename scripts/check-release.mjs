import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function validateRelease({ metadata, tag, refType, repository, isPrivate, npmVersion }) {
  if (repository !== "gtimeyin/threadmark-sdk") {
    throw new Error("Releases must originate from gtimeyin/threadmark-sdk, not a fork.");
  }
  if (isPrivate !== "false") {
    throw new Error("npm provenance requires a public source repository. Review Git history before changing visibility.");
  }
  if (metadata.name !== "threadmark-react" || metadata.private) {
    throw new Error("Only the public threadmark-react SDK may be released.");
  }
  if (!/^\d+\.\d+\.\d+-beta\.\d+$/.test(metadata.version)) {
    throw new Error("This workflow only publishes beta releases; stable releases require a separate decision.");
  }
  if (refType !== "tag" || tag !== `v${metadata.version}`) {
    throw new Error("The release tag must exactly match v followed by the SDK package version.");
  }
  if (metadata.repository?.url !== "git+https://github.com/gtimeyin/threadmark-sdk.git") {
    throw new Error("Package repository metadata must match the provenance source.");
  }
  const config = metadata.publishConfig;
  if (config?.access !== "public" || config?.tag !== "beta" || config?.provenance !== true) {
    throw new Error("Public access, the beta distribution tag, and provenance must remain enabled.");
  }
  const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(npmVersion ?? "");
  if (!version || (
    Number(version[1]) < 11 ||
    (Number(version[1]) === 11 && Number(version[2]) < 5) ||
    (Number(version[1]) === 11 && Number(version[2]) === 5 && Number(version[3]) < 1)
  )) {
    throw new Error("Trusted publishing requires npm 11.5.1 or newer.");
  }
  return metadata.version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const metadata = JSON.parse(readFileSync(new URL("../packages/react/package.json", import.meta.url), "utf8"));
    const version = validateRelease({
      metadata,
      tag: process.env.GITHUB_REF_NAME,
      refType: process.env.GITHUB_REF_TYPE,
      repository: process.env.GITHUB_REPOSITORY,
      isPrivate: process.env.REPOSITORY_PRIVATE,
      npmVersion: process.env.NPM_VERSION,
    });
    console.log(`Release preflight passed: threadmark-react@${version}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
