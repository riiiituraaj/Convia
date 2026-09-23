# CONVIA brand assets

Place the official CONVIA brand mark in this folder as:

```
public/logo.png
```

Requirements:

- Keep the original proportions — the `<Logo />` component
  (`src/components/brand/Logo.tsx`) renders it with `height` fixed and
  `width: auto`, so the mark is never stretched or distorted.
- Any surrounding whitespace is fine: the component only constrains height, so
  padding inside the asset stays visually consistent.
- If the file is missing, `<Logo />` degrades to the CONVIA wordmark so the
  navigation stays usable. No other logo is ever generated.

The same asset is used for:

| Location                  | Component            |
| ------------------------- | -------------------- |
| Sidebar / drawer branding | `<Logo />`           |
| Mobile top bar            | `<LogoMark />`       |
| Branded empty states      | `<EmptyState branded />` |
