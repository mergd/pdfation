const CHUNK_SIZE = 0x8000

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  let binary = ''

  for (let index = 0; index < bytes.length; index += CHUNK_SIZE) {
    const chunk = bytes.subarray(index, index + CHUNK_SIZE)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

export const blobToBase64 = async (blob: Blob): Promise<string> =>
  arrayBufferToBase64(await blob.arrayBuffer())

export const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: mimeType })
}
