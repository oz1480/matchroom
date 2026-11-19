import type { Camera } from './types'

function isCamera(value: unknown): value is Camera {
  if (typeof value !== 'object' || value === null) return false
  const camera = value as Record<string, unknown>
  return typeof camera.id === 'string'
    && typeof camera.name === 'string'
    && typeof camera.description === 'string'
    && typeof camera.hlsUrl === 'string'
    && typeof camera.whepUrl === 'string'
    && typeof camera.order === 'number'
}

export async function getCameras(signal?: AbortSignal): Promise<Camera[]> {
  const response = await fetch('/api/cameras', { signal })
  if (!response.ok) throw new Error(`Camera service returned ${response.status}`)
  const data: unknown = await response.json()
  if (!Array.isArray(data) || !data.every(isCamera)) {
    throw new Error('Camera service returned an invalid camera catalogue')
  }
  return data
}
