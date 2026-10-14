# Production release 2026-10-15

Scope: all accumulated local source changes, reading performance/independent article loading skeleton, infinite scroll and return restoration, avatar icons, post formatting editor, literal post blank-line rendering, and all 16 user-approved final post sources under posts/.

Data: posts/ is an intentional snapshot of the user's saved .local/post-format-editor draft files, excluding private editor.env. post-manifest.json records SHA256. posts-before.json contains only public production content for comparison. The local drafts remain intact. CLI plain post publication now preserves the authored whitespace rather than serializing it away; one conventional newline after frontmatter is removed, matching the editor body boundary.

Production backup completed at /var/backups/yoryon/20261014T163850Z on the existing host; private backup content remains protected there. backup-receipt.log records completion and prior API image. No database schema change is required. Rollback: restore prior image specified in receipt, and promote the previous Vercel deployment recorded in vercel-before.json; content restoration requires the approved backup/public before snapshot through the normal publishing path.

Validation: pnpm typecheck and actual isolated CLI→API→browser content/blank-line checks are in audit.md. API built with docker build --platform linux/amd64 -f deploy/Dockerfile.production -t yoryon-api:release-20261015 .; native-runtime.log verifies target x64 sharp WebP and argon2 behavior. Previous source-only web build and real browser acceptance are in post-blank-lines-20261015 and scroll-restoration-20261015. Production frontend receives its own Vercel build on main push.

Before/after network measurements are separate from actual UI latency; see performance-before/ and subsequent report. Browser tooling timeout is not a measured website latency. Tests do not send email or create production accounts.

Full source build was repeated in the separate workspace recorded by build-workspace.txt using the isolated preview.env with NODE_ENV=production and pnpm build; PASS. Current apps/web .next and both user preview servers were not overwritten. Native container verification used docker run --rm --platform linux/amd64 --entrypoint node <image>, then sharp(...).webp().toBuffer() and argon2.hash/verify against an isolated constant.

Publication commands use the existing protected server environment; no secrets are passed on the command line:

```sh
git push origin main
docker save yoryon-api:66fb2580fa0beee799e9def1ed0dea01957febf4 | gzip -1 | ssh admin@8.222.152.17 'gzip -d | sudo docker load'
scp -r artifacts/production-release-20261015/posts admin@8.222.152.17:/opt/yoryon/posts/formatted-posts-20261015
# Server /opt/yoryon/.env: YORYON_IMAGE=yoryon-api:66fb2580fa0beee799e9def1ed0dea01957febf4
# docker compose -f compose.neon.yml up -d --wait api
# sudo flock --wait 120 /var/lock/yoryon-cli.lock docker compose -f compose.neon.yml run --rm --name yoryon-cli-run cli publish /posts/formatted-posts-20261015
```

The frontend is compatible with the old API fallback while the image uploads; publication rotates the list version after the new API is installed, causing fresh new-contract feed reads. Final verification must occur after both phases, not after the Vercel build alone.

## Final release result

Production API image 66fb2580fa0beee799e9def1ed0dea01957febf4 is healthy (api-rollout.log); frontend deployment dpl_CNUKYQ3ZKaY9YTJaGFGH2VoB649L is READY and bound to yoryon.com (domain-release.json). The source commit was pushed to origin/main. A subsequent evidence-only commit also excludes .local from Docker build context; it does not change application runtime code.

All 16 posts were published through the production CLI; all 16 cache events reported verified. production-post-equality.json checks source body SHA256 against the actual production API body, and all 16 match exactly. Published dates/type/public visibility remain as authored. content-diff.json confirms rendered text values unchanged from before (raw Markdown differs in whitespace/escapes). Private draft env was not committed or uploaded.

Independent final-acceptance.md records real production API/HTML/resource checks and before/after network measurements. Article TTFB median393→252ms, full HTTP response433→402ms, post endpoint322→255ms; three sequential samples per path with default cache and no throttle, not strict cold cache. This is not a browser interaction benchmark. The before single UI coarse expand measurement491ms includes tooling overhead; the after first post has fewer paragraphs and is fully visible without an expand button, so it is not a like-for-like numeric comparison.

Main agent fresh IAB tab9 confirmed the published homepage DOM: no redundant read-more link, revised paragraph grouping, full first post, and remaining long posts have expand controls. Further CDP/read-only evaluate/navigation calls timed out, including the fallback Chrome availability attempt. Precise click→skeleton/body visibility, post-release scroll restoration and visual shimmer animation are UNVERIFIED in production this run; previous isolated browser acceptance is linked above. No fabricated UI timing or claim of zero latency.

Production frontend initial15-minute error scan returned no entries (runtime-errors.jsonl). This is a bounded observation, not proof of long-term absence of errors. Authenticated/paid writes, email, purchase and mobile timing were not exercised. No production test accounts/data were created; only user-authorized final content was updated.
