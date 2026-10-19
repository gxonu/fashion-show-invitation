# Netlify mobile release

Source: `develop` at `bdb091480bb6a159222919a377202892cc78c72d`.

Connect this repository in Netlify with production branch `netlify`, publish directory `public`, and an empty build command.

Generated files only. Update the source branch, then run `python3 scripts/deploy_netlify.py --roster private/rosters/lookup.json` there; add `--include-demo` for client testing.

The static roster contains approved public names, seats, VIP flags and phone hashes. Hashes do not make the roster private. Original spreadsheets, PDFs and raw phone numbers are excluded.
