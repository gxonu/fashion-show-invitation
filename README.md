# Netlify mobile release

Source: `develop` at `004c6b198fb481df7a8017a19b65a60c6f2d6b54`.

Connect this repository in Netlify with production branch `netlify`, publish directory `public`, and an empty build command.

Generated files only. Update the source branch, then run `python3 scripts/deploy_netlify.py --roster private/rosters/lookup.json` there; add `--include-demo` for client testing.

The static roster contains approved public names, seats, VIP flags and phone hashes. Hashes do not make the roster private. Original spreadsheets, PDFs and raw phone numbers are excluded.
