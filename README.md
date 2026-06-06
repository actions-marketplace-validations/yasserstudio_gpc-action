# GPC: Publish to Google Play

Upload your Android app to Google Play from GitHub Actions, with a built-in compliance gate. Powered by the [GPC CLI](https://github.com/yasserstudio/gpc).

Most Play upload actions only upload. This one can also check your app against Play policy before it goes out, so a bad build fails the job instead of reaching review.

## Quick start

```yaml
- uses: yasserstudio/gpc-action@v1
  with:
    service-account-json: ${{ secrets.GPC_SERVICE_ACCOUNT }}
    package-name: com.example.app
    release-files: app/build/outputs/bundle/release/app-release.aab
    track: internal
```

Store your Google service account key (the JSON contents) as a repository secret named `GPC_SERVICE_ACCOUNT`.

## Why this action

- **Preflight compliance gate.** `preflight: true` (the default) runs offline policy scanners before upload and fails the job on findings. No other Play action does this.
- **One-line migration.** Already using `r0adkll/upload-google-play`? Change the `uses:` line and keep your existing `with:` block (see below).
- **Full GPC under the hood.** The `args` escape hatch runs any `gpc` command (promote, watch, changelog, and more).

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `service-account-json` | Service account key JSON contents (store as a secret). Required. | |
| `package-name` | App package name, e.g. `com.example.app`. Required. | |
| `release-files` | Path to the `.aab`/`.apk`. v1 uploads a single file. Required. | |
| `track` | `internal`, `alpha`, `beta`, `production`, or a custom track. | `internal` |
| `status` | `completed`, `inProgress`, `draft`, or `halted`. | |
| `rollout` | Staged rollout percentage (1-100). | |
| `user-fraction` | Staged rollout as a fraction (0.0-1.0); converted to a percentage. | |
| `release-notes` | Release notes for the default locale (en-US). | |
| `release-notes-dir` | Directory of localized notes (`<dir>/<locale>.txt`). | |
| `name` | Release name. | version name |
| `mapping` | ProGuard/R8 `mapping.txt`. | |
| `in-app-update-priority` | In-app update priority, 0-5. | |
| `changes-not-sent-for-review` | Commit without sending for review. | `false` |
| `retain-version-codes` | Comma-separated version codes to retain. | |
| `dry-run` | Preview/validate against Play without committing a release. | `false` |
| `preflight` | Run the preflight compliance gate before upload. | `true` |
| `preflight-fail-on` | Severity that fails the job: `critical`, `error`, `warning`, `info`. | `error` |
| `args` | Run an arbitrary `gpc` command; opinionated inputs are ignored. | |
| `gpc-version` | GPC CLI version, or `latest`. | pinned |
| `working-directory` | Directory to run gpc in. | |

## Outputs

| Output | Description |
|--------|-------------|
| `version-code` | The uploaded version code. |
| `track` | The track the release was created on. |
| `status` | The release status. |
| `preflight-passed` | `true`/`false` if preflight ran, or `skipped`. |
| `result` | The full JSON result from gpc. |

## Migrating from `r0adkll/upload-google-play`

Change the `uses:` line. Your existing inputs keep working as compatibility aliases:

```yaml
# before
- uses: r0adkll/upload-google-play@v1
  with:
    serviceAccountJson: ${{ secrets.SERVICE_ACCOUNT_JSON }}
    packageName: com.example.app
    releaseFiles: app-release.aab
    track: production
    userFraction: 0.1

# after
- uses: yasserstudio/gpc-action@v1
  with:
    serviceAccountJson: ${{ secrets.SERVICE_ACCOUNT_JSON }}
    packageName: com.example.app
    releaseFiles: app-release.aab
    track: production
    userFraction: 0.1
```

The camelCase aliases (`serviceAccountJson`, `packageName`, `releaseFiles`, `releaseName`, `userFraction`, `whatsNewDirectory`, `mappingFile`, `inAppUpdatePriority`, `changesNotSentForReview`, `versionCodesToRetain`) are accepted and emit a deprecation notice pointing at the canonical kebab-case name. `userFraction` (0.0-1.0) is converted to `rollout` (percent) automatically.

**Not supported in v1** (ignored with a warning): `tracks` (multiple at once), `existingEditId`, `debugSymbols`. Multiple files / globs in `release-files` are not supported in v1; pass a single file.

## How it works

The action downloads the pinned GPC standalone binary for your runner platform, verifies its SHA-256 checksum against the release `checksums.txt`, caches it, and runs it. The service account secret is masked and passed via environment, never written to disk. The action runs gpc with an isolated config directory so the credentials and package you pass in always win, even on self-hosted runners that already have a gpc profile configured.

## License

MIT. See [LICENSE](LICENSE).
