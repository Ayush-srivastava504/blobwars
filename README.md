# Chunk-load-error auto-recovery fix

## What's in here
- `frontend/app/chunk-error-handler.tsx` — new file. Client component that
  listens for a failed Next.js chunk load (the "ChunkLoadError" you saw in
  the console, caused by a stale tab trying to fetch a chunk file that no
  longer exists after a redeploy) and auto-reloads the page once to recover.
- `frontend/app/layout.tsx` — updated. Imports and mounts
  `<ChunkErrorHandler />` at the top of `<body>` so it's active on every route.

## How to apply
Copy both files into your repo at the same paths, overwriting the existing
`frontend/app/layout.tsx`:

    cp -r frontend/app/chunk-error-handler.tsx  <your-repo>/frontend/app/
    cp -r frontend/app/layout.tsx                <your-repo>/frontend/app/

(If you've since changed `layout.tsx` yourself, just add the two lines by hand
instead of overwriting — see the diff below.)

## Diff summary (layout.tsx)
```
+ import ChunkErrorHandler from "./chunk-error-handler";
  ...
  <body className="font-game text-white bg-arena-bg">
+   <ChunkErrorHandler />
    {children}
  </body>
```

## Why this fixes it
Next.js build chunks are content-hashed. After you redeploy, a browser tab
that was already open still references the old build's chunk filenames —
when it tries to lazy-load one client-side, the file 404s because your
deploy process replaces the static assets rather than keeping old ones
around. This handler catches that failure and reloads the page once
(guarded by sessionStorage so it won't loop if a chunk is missing for some
other reason), so the user silently picks up the new build instead of
seeing a broken screen.

This treats the symptom, not the root cause — if you want chunks to never
404 in the first place, the real fix is on the deploy side: keep the
previous build's static assets available for a while after cutover instead
of overwriting them immediately. Worth doing if this keeps happening, but
this component is the low-effort fix for now.
