# Bible Memory

A React + TypeScript + Vite app that also ships as an unpacked Chrome
extension.

## Developing the extension

The Chrome extension does **not** run the Vite dev server. It loads the static
build output in `dist/` (the Vite bundle plus a copied `manifest.json` and
`background.js`). Because of that:

- **`npm run dev` is for the web app only.** It runs the Vite dev server with
  hot reload. The extension never loads from it.
- **Clicking reload ↻ on `chrome://extensions` does not rebuild anything.** It
  only reloads whatever is *already* in `dist/`. If you edit source and only
  click reload, you'll see no change — because `dist/` is still the old build.

### The build → reload cycle

1. Rebuild `dist/` from source:
   ```
   npm run build:extension
   ```
   This runs `npm run build` (`tsc -b && vite build`) and then copies
   `manifest.json` + `background.js` into `dist/`.
2. Go to `chrome://extensions` and click the reload ↻ button on the Bible
   Memory card so Chrome picks up the new `dist/`.

Load the extension the first time via `chrome://extensions` → enable
"Developer mode" → "Load unpacked" → select the `dist/` folder.

### Watch mode (recommended while iterating)

```
npm run build:extension:watch
```

This runs `vite build --watch` and re-copies `manifest.json` +
`background.js` into `dist/` after every rebuild, so `dist/` stays current as
you edit. You still have to click reload ↻ on `chrome://extensions` after each
rebuild — Chrome does not hot-reload unpacked extensions. (Watch mode skips the
`tsc -b` type-check that `npm run build:extension` runs.)

---

## Template notes

This project was scaffolded from the React + TypeScript + Vite template with
HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
