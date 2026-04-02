// tests/login.spec.js
const { test, expect } = require('@playwright/test');

test('la página de login carga correctamente', async ({ page }) => {
  await page.goto('/login');

  await expect(page).toHaveTitle('Login — QA App');
  await expect(page.getByTestId('login-form')).toBeVisible();
  await expect(page.getByTestId('input-email')).toBeVisible();
  await expect(page.getByTestId('input-password')).toBeVisible();
  await expect(page.getByTestId('btn-login')).toBeVisible();
});
