import { expect, test } from '@playwright/test'

test('Director View receives real WebRTC video frames', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Main camera' })).toBeVisible()
  const video = page.locator('.player-column > .video-shell video')

  await expect.poll(
    () => video.evaluate(element => (element as HTMLVideoElement).videoWidth),
    { timeout: 30_000, message: 'WebRTC video should deliver decoded frames' },
  ).toBeGreaterThan(0)

  await expect(page.locator('.video-label')).toContainText('LOW-LATENCY WEBRTC')
})

test('Multi-View receives all three independent camera feeds', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'MULTI-VIEW' }).click()

  const videos = page.locator('.multi-view-tile video')
  await expect(videos).toHaveCount(3)

  await expect.poll(
    () => videos.evaluateAll(elements =>
      elements.filter(element => (element as HTMLVideoElement).videoWidth > 0).length,
    ),
    { timeout: 35_000, message: 'All three Multi-View tiles should decode video' },
  ).toBe(3)
})

test('Compatibility mode plays the HLS fallback', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'COMPATIBILITY' }).click()

  const video = page.locator('.player-column > .video-shell video')
  await expect.poll(
    () => video.evaluate(element => (element as HTMLVideoElement).videoWidth),
    { timeout: 30_000, message: 'HLS fallback should deliver decoded frames' },
  ).toBeGreaterThan(0)

  await expect(page.locator('.video-label')).toContainText('HLS PLAYBACK')
})
