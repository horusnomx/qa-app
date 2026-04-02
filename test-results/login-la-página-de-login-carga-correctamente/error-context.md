# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.js >> la página de login carga correctamente
- Location: tests\login.spec.js:4:1

# Error details

```
Error: expect(page).toHaveTitle(expected) failed

Expected: "Login — QA App"
Received: ""
Timeout:  5000ms

Call log:
  - Expect "toHaveTitle" with timeout 5000ms
    9 × unexpected value ""

```

# Page snapshot

```yaml
- generic [ref=e2]: "{\"mensaje\":\"Ruta GET /login no encontrada.\"}"
```

# Test source

```ts
  1  | // tests/login.spec.js
  2  | const { test, expect } = require('@playwright/test');
  3  | 
  4  | test('la página de login carga correctamente', async ({ page }) => {
  5  |   await page.goto('/login');
  6  | 
> 7  |   await expect(page).toHaveTitle('Login — QA App');
     |                      ^ Error: expect(page).toHaveTitle(expected) failed
  8  |   await expect(page.getByTestId('login-form')).toBeVisible();
  9  |   await expect(page.getByTestId('input-email')).toBeVisible();
  10 |   await expect(page.getByTestId('input-password')).toBeVisible();
  11 |   await expect(page.getByTestId('btn-login')).toBeVisible();
  12 | });
  13 | 
```