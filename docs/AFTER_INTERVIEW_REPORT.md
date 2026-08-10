# After-Interview Report

## Purpose

The after-interview workspace converts WebVTT captions into a normalized transcript and a review packet. It surfaces descriptive participation context and evidence excerpts for human review. It does not score candidates, establish misconduct, or make hiring decisions.

## Pipeline

```text
Authenticated frontend
  -> POST /api/after-interview/ingest
  -> validated sample, pasted VTT, or server-side Graph source
  -> WebVTT parser
  -> normalized transcript
  -> review-only report and evidence packet
```

The endpoint is behind the standard Supabase bearer-token middleware. The frontend uses the shared authenticated API client, and identity or ownership fields are rejected from the request body.

## Run locally

1. Configure the root `.env` and `apps/frontend/.env` as described in `README.md`.
2. Install dependencies with `npm install`.
3. Start the API and frontend in separate terminals:

   ```powershell
   npm run dev:api
   npm run dev
   ```

4. Open `http://localhost:5173`, sign in, and choose **Review Transcript**.
5. Generate a packet from the bundled sample or paste WebVTT content.

The sample transcript is included in web development and Electron packages.

## Microsoft Graph mode

Graph mode is API-only scaffolding and is not exposed in the UI. It returns the bundled sample while `MOCK_GRAPH=true`. For a controlled development test, set `MOCK_GRAPH=false` and place a short-lived delegated `GRAPH_ACCESS_TOKEN` in the ignored root `.env`. The current adapter reads MIME content from `/me/messages/{messageId}/$value`; production Teams meeting-transcript integration requires a separately reviewed Graph permissions and endpoint design.

Never put a Graph token, Supabase service-role key, Azure key, tenant secret, or client secret in `apps/frontend/.env` or a `VITE_` variable.

## Validation

`npm run check` includes parser, generator, route pipeline, ownership-rejection, and frontend request-adapter tests. `npm run build` verifies the report screen is included in the production UI.
