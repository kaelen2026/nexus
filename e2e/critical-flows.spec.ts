import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

const apiBaseUrl = 'http://localhost:3000'

function uniqueEmail(testName: string): string {
  const slug = testName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `e2e-${slug}-${Date.now()}@example.com`
}

async function latestEmailOtp(request: APIRequestContext, email: string): Promise<string> {
  const response = await request.get(`${apiBaseUrl}/dev/email/latest`, {
    params: { email },
  })
  expect(response.ok()).toBe(true)
  const message = (await response.json()) as { otp: string }
  return message.otp
}

async function openEmailLogin(page: Page, email: string) {
  await page.goto('/login')
  await page.getByRole('button', { name: '邮箱', exact: true }).click()
  await page.getByLabel('邮箱', { exact: true }).fill(email)
}

async function loginWithEmailOtp(page: Page, request: APIRequestContext, email: string) {
  await openEmailLogin(page, email)
  await page.getByRole('button', { name: '获取验证码' }).click()
  await expect(page.getByRole('heading', { name: '输入验证码' })).toBeVisible()
  await page.getByLabel('6 位验证码').fill(await latestEmailOtp(request, email))
  await page.getByRole('button', { name: '继续' }).click()
  await expect(page.getByRole('heading', { name: '和 Nexus 一起创作' })).toBeVisible()
}

async function resetPassword(
  page: Page,
  request: APIRequestContext,
  email: string,
  password: string,
) {
  await openEmailLogin(page, email)
  await page.getByRole('button', { name: '密码登录' }).click()
  await page.getByRole('button', { name: '忘记密码？' }).click()
  await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible()
  await page.getByLabel('6 位验证码').fill(await latestEmailOtp(request, email))
  await page.getByLabel('新密码').fill(password)
  await page.getByRole('button', { name: '保存新密码' }).click()
  await expect(page.getByRole('heading', { name: '登录 Nexus' })).toBeVisible()
}

async function loginWithPassword(page: Page, email: string, password: string) {
  await openEmailLogin(page, email)
  await page.getByRole('button', { name: '密码登录' }).click()
  await page.getByLabel('密码', { exact: true }).fill(password)
  const loginResponse = page.waitForResponse(
    (response) => response.url() === `${apiBaseUrl}/auth/email/password/login`,
  )
  await page.getByRole('button', { name: '登录', exact: true }).click()
  expect((await loginResponse).ok()).toBe(true)
  await page.waitForURL('http://localhost:3001/')
}

test('email OTP creates a session and loads the current user', async ({ page, request }) => {
  const email = uniqueEmail('email-otp')

  await loginWithEmailOtp(page, request, email)

  await expect(page.getByText('账户状态').locator('..')).toContainText('正常')
  await expect(page.getByText('用户 ID').locator('..').getByRole('definition')).not.toBeEmpty()
})

test('password login and recovery revoke the previous session', async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(60_000)
  const email = uniqueEmail('password-recovery')
  const firstPassword = 'first-password-1234'
  const recoveredPassword = 'recovered-password-5678'

  await loginWithEmailOtp(page, request, email)

  const passwordContext = await browser.newContext()
  const passwordPage = await passwordContext.newPage()
  await resetPassword(passwordPage, request, email, firstPassword)
  await loginWithPassword(passwordPage, email, firstPassword)

  const recoveryContext = await browser.newContext()
  const recoveryPage = await recoveryContext.newPage()
  await resetPassword(recoveryPage, request, email, recoveredPassword)

  await passwordPage.reload()
  await expect(passwordPage).toHaveURL(/\/login$/)

  await Promise.all([passwordContext.close(), recoveryContext.close()])
})

test('authenticated generation returns content and recorded usage', async ({ page, request }) => {
  const email = uniqueEmail('llm-generation')
  const prompt = 'create a concise release checklist'

  await loginWithEmailOtp(page, request, email)
  await page.getByLabel('你想让 Nexus 做什么？').fill(prompt)
  await page.getByRole('button', { name: '生成内容' }).click()

  await expect(page.getByRole('heading', { name: '生成结果' })).toBeVisible()
  await expect(page.getByText(`Local response: ${prompt}`)).toBeVisible()
  await expect(page.getByText(/标准模型 · \d+ tokens/)).toBeVisible()
})
