/* Reduz fotos antes do envio — importante para quem usa internet móvel na zona rural.
   Uma foto de celular de 5 MB vira ~300 KB sem perda visível. */
export async function reduzirImagem(arquivo: File, maxLado = 1600, qualidade = 0.82): Promise<File> {
  if (!arquivo.type.startsWith('image/') || arquivo.type === 'image/gif') return arquivo
  try {
    const bitmap = await createImageBitmap(arquivo)
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
    if (escala === 1 && arquivo.size < 700_000) return arquivo
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', qualidade))
    if (!blob || blob.size >= arquivo.size) return arquivo
    return new File([blob], arquivo.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return arquivo
  }
}
