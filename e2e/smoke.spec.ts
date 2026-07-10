import { expect, test } from '@playwright/test'

// Fixed user — the DB is truncated in global-setup, so this is deterministic
// across runs (stable screenshots). The auto-claimed username will be
// "ada-lovelace" (slugified from the name).
const USER = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'password123' }

test('home page renders for a signed-out visitor', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /show off\s*your\s*slop/i })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Join the show' })).toBeVisible()
  await expect(page).toHaveScreenshot('home.png', { fullPage: true, animations: 'disabled' })
})

test('sign-up page renders', async ({ page }) => {
  await page.goto('/sign-up')
  await expect(page.getByRole('heading', { name: 'Join the show' })).toBeVisible()
  await expect(page).toHaveScreenshot('sign-up.png', { fullPage: true, animations: 'disabled' })
})

test('unknown route returns a 404 with the not-found page', async ({ page }) => {
  const res = await page.goto('/this-page-does-not-exist/nope/nope')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
  await expect(page).toHaveScreenshot('not-found.png', { fullPage: true, animations: 'disabled' })
})

test('sign up → post slop → publish → project page shows the receipt', async ({ page }) => {
  // Sign up lands on /settings with an auto-claimed username.
  await page.goto('/sign-up')
  await page.getByLabel('Name').fill(USER.name)
  await page.getByLabel('Email').fill(USER.email)
  await page.getByLabel('Password').fill(USER.password)
  await page.getByRole('button', { name: 'Sign up' }).click()
  await page.waitForURL('**/settings')
  await expect(page.getByLabel('Username')).toHaveValue('ada-lovelace')

  // Create a draft.
  await page.goto('/new')
  await page.getByLabel('Title').fill('Analytical Engine Demo')
  await page.getByLabel('Tagline').fill('The first program, re-slopped')
  await page.getByLabel('Models used').fill('Claude Opus 4.6')
  await page.getByLabel('Models used').press('Enter')
  await page.getByLabel('Estimated spend (USD)').fill('12.5')
  await page.getByLabel('Build time (hours)').fill('3')
  await page.getByRole('button', { name: 'Create draft' }).click()
  await page.waitForURL('**/ada-lovelace/analytical-engine-demo/edit')

  // Publish it and check the public page + receipt.
  await page.getByRole('button', { name: 'Publish it' }).click()
  await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible()
  await page.getByRole('link', { name: 'View page' }).click()
  await page.waitForURL('**/ada-lovelace/analytical-engine-demo')
  await expect(page.getByRole('heading', { name: 'Analytical Engine Demo' })).toBeVisible()
  await expect(page.getByText('OFFICIAL AI RECEIPT')).toBeVisible()
  // The cost prints twice on the receipt (EST. SPEND + TOTAL DAMAGE).
  await expect(page.getByText('$12.50')).toHaveCount(2)
  await expect(page.getByText('Claude Opus 4.6')).toBeVisible()

  // It shows up on home (possibly in several sections) + the profile page.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Analytical Engine Demo' }).first()).toBeVisible()
  await page.goto('/ada-lovelace')
  await expect(page.getByRole('heading', { name: 'Ada Lovelace' })).toBeVisible()

  // Sign out returns to the signed-out state.
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('link', { name: 'Join the show' })).toBeVisible()
})
