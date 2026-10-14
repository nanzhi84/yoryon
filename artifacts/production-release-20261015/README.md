# Production release 2026-10-15

Scope: all accumulated local source changes, reading performance/independent article loading skeleton, infinite scroll and return restoration, avatar icons, post formatting editor, literal post blank-line rendering, and all 16 user-approved final post sources under posts/.

Data: posts/ is an intentional snapshot of the user's saved .local/post-format-editor draft files, excluding private editor.env. post-manifest.json records SHA256. posts-before.json contains only public production content for comparison. The local drafts remain intact. CLI plain post publication now preserves the authored whitespace rather than serializing it away; one conventional newline after frontmatter is removed, matching the editor body boundary.

Production backup completed at /var/backups/yoryon/20261014T163850Z on the existing host; private backup content remains protected there. backup-receipt.log records completion and prior API image. No database schema change is required. Rollback: restore prior image specified in receipt, and promote the previous Vercel deployment recorded in vercel-before.json; content restoration requires the approved backup/public before snapshot through the normal publishing path.

Validation: pnpm typecheck and actual isolated CLI→API→browser content/blank-line checks are in audit.md. API built with docker build --platform linux/amd64 -f deploy/Dockerfile.production -t yoryon-api:release-20261015 .; native-runtime.log verifies target x64 sharp WebP and argon2 behavior. Previous source-only web build and real browser acceptance are in post-blank-lines-20261015 and scroll-restoration-20261015. Production frontend receives its own Vercel build on main push.

Before/after network measurements are separate from actual UI latency; see performance-before/ and subsequent report. Browser tooling timeout is not a measured website latency. Tests do not send email or create production accounts.
