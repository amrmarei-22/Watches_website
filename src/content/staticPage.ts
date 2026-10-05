export type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }

export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.split(/\r?\n/)
  const blocks: MarkdownBlock[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index].trim()
    if (!line) {
      index += 1
      continue
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
      index += 1
      continue
    }
    const listMatch = /^([-*]|\d+\.)\s+(.+)$/.exec(line)
    if (listMatch) {
      const ordered = listMatch[1].endsWith('.')
      const items: string[] = []
      while (index < lines.length) {
        const item = /^([-*]|\d+\.)\s+(.+)$/.exec(lines[index].trim())
        if (!item || item[1].endsWith('.') !== ordered) break
        items.push(item[2])
        index += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }
    const paragraph: string[] = [line]
    index += 1
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s+|^([-*]|\d+\.)\s+/.test(lines[index].trim())) {
      paragraph.push(lines[index].trim())
      index += 1
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
  }
  return blocks
}

export function isContentPresent(markdown: string): boolean {
  return markdown.trim().length > 0
}
