# Desktop Packaging

## Architecture

The Windows application uses Electron as a narrow desktop shell:

```text
Electron BrowserWindow
  -> random 127.0.0.1 port
  -> embedded Express API
  -> built React application
  -> Supabase Auth, RLS, PostgreSQL, and private Storage
```

The user does not start Node.js, Vite, or the API separately. Electron starts one loopback-only Express server on an available port, serves the production frontend from the same origin, and closes the server when the application exits.

## Configuration

Create `apps/frontend/.env` before building:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

`npm run desktop:prepare` validates these values and writes `.desktop-build/config.json`. This generated file contains only the Supabase URL, publishable key, and request-size limit. Publishable keys are public client configuration and still rely on RLS. The service-role key, database password, provider secrets, and future AI keys must never be packaged.

Apply and verify all Supabase migrations before distributing a build. A desktop binary does not contain PostgreSQL or Supabase and requires network access to the configured project.

## Local Desktop Run

```bash
npm install
npm run desktop:run
```

This prepares public configuration, builds the frontend in desktop mode, starts the embedded API, and opens Electron. Desktop mode intentionally leaves `VITE_API_BASE_URL` empty so the frontend uses its random same-origin API address.

## Windows Executables

```bash
npm run desktop:package
```

Artifacts are written under `release/`:

- an NSIS installer executable with per-user installation and optional install location;
- a portable x64 executable that can run without installation.

The executable includes Chromium and is therefore substantially larger than the web bundle. Do not distribute `release/` as source-controlled content.

## Security Controls

- Renderer Node.js integration is disabled.
- Context isolation, Chromium sandboxing, and web security are enabled.
- Renderer permission requests are denied.
- New windows and external HTTP(S) links open in the operating-system browser.
- App navigation is restricted to the embedded loopback origin.
- The embedded API binds only to `127.0.0.1` on a random port and still requires Supabase bearer tokens.
- The frontend and API receive a restrictive Content Security Policy.
- ZIP exports remain client-side, and Electron pauses each renderer download until the user selects a save destination.
- The renderer receives no native path and has no unrestricted filesystem access.

## Release Checklist

1. Confirm the configured Supabase project and apply pending migrations.
2. Run `npm run check` and `npm run build`.
3. Run `npm audit --omit=dev` and review packaging-tool advisories separately.
4. Build on a controlled Windows machine.
5. Sign the installer and portable executable with an organization-controlled Windows code-signing certificate.
6. Scan artifacts and test install, sign-in, upload, archive, ZIP export, sign-out, and uninstall on a clean Windows account.
7. Publish checksums through the trusted download channel.

Unsigned development builds can trigger Microsoft Defender SmartScreen warnings. Automatic updates, certificate configuration, and release-channel hosting are not configured yet and are required before broad external distribution.
