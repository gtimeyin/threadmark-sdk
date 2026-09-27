# SDK beta releases

`publish.yml` publishes `threadmark-react` using npm trusted publishing (OIDC),
without an npm token or GitHub repository secret. Provenance stays enabled and
the `latest` npm distribution tag is not changed.

## One-time setup

1. Review **all Git history and remote branches** for internal planning or secrets
   before deciding whether to make `gtimeyin/threadmark-sdk` public. Removing files
   from the working tree does not remove them from history. The workflow fails
   closed while the source repository is private, because npm provenance requires
   a public repository. Do not change visibility without maintainer approval.
   If history contains private planning or evidence, prefer a new, clean public
   source repository and keep the original private. A source export must not
   include `.git`, local environment files, internal documents, or QA captures.
   Before switching repositories, update the SDK repository metadata, public
   links, release guard, and npm trusted publisher to the approved destination.
2. In the `threadmark-react` npm package settings, add a GitHub Actions trusted
   publisher with these exact fields:
   - Organization/user: `gtimeyin`
   - Repository: `threadmark-sdk`
   - Workflow filename: `publish.yml` (not the full path)
   - Environment name: leave blank (this workflow does not use an environment)
   - Allowed action: enable direct `npm publish` for this workflow.
3. Complete any npm account/2FA approval through npm's own interface. Never paste
   access tokens into chat or commit them. Revoke previously exposed tokens.

See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for
the source visibility, Node/npm version, and OIDC requirements. After the first
successful trusted publication, consider restricting token-based publishing in
npm package settings; review that account policy separately before changing it.

## Each beta release

1. Update the SDK version, lockfile, and changelog; commit and push to `main`.
2. Run `npm run verify` and `node --test tests/release.test.mjs`.
3. Create and push the matching release tag from a commit on `main`. For beta.8:

   ```sh
   git tag -a v0.1.0-beta.8 -m "threadmark-react 0.1.0-beta.8"
   git push origin v0.1.0-beta.8
   ```

4. Inspect the **Publish React SDK beta** workflow. It validates the tag and
   source, reruns the complete verification suite, and uploads the built tarball.
   A separate publish job receives OIDC permission, verifies the tarball hash,
   and publishes it without running package lifecycle scripts or installing
   project dependencies. Release jobs do not restore dependency caches, and
   actions are pinned to immutable commits.
5. Confirm the npm version, tarball hash, `beta` tag, and provenance attestation.
   Failed runs can be retried only after checking that the version has not
   already been published; npm versions are immutable.

If a workflow-only fix is needed after tagging, leave the release tag unchanged.
The workflow supports a manual retry on `main` with the existing tag as its
`tag` input. It requires the tag to match the SDK version and verifies that SDK
source and dependency manifests are identical to that tag before building from
`main`. Provenance therefore identifies the actual workflow/build commit.
Do not retry an already published version.

This workflow deliberately rejects stable or non-beta prerelease versions.
Changing the stable release policy or removing provenance requires a separate
maintainer decision. No publication is triggered by an ordinary push to `main`.
