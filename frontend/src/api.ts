import type { Camera } from './types'
export async function getCameras(signal?: AbortSignal): Promise<Camera[]> {
 const response = await fetch('/api/cameras',{signal})
 if(!response.ok) throw new Error(`Camera service returned ${response.status}`)
 const data: unknown = await response.json()
 if(!Array.isArray(data)) throw new Error('Camera service returned an invalid catalogue')
 return data as Camera[]
}
