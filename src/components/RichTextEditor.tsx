import React, { useRef, useEffect, useState, useCallback } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  compact?: boolean
}

/**
 * Converts Markdown string to clean HTML for visual contenteditable editing
 */
function markdownToHtml(md: string): string {
  if (!md) return ''

  let html = md
    // Bold: **text**
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    // Strikethrough: ~~text~~
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    // Italic: *text* or _text_
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/_([^_]+)_/g, '<i>$1</i>')

  // Convert lines
  const lines = html.split('\n')
  const outLines: string[] = []
  let inUl = false
  let inOl = false

  lines.forEach(line => {
    const trimmed = line.trim()

    // Horizontal Rule
    if (trimmed === '---' || trimmed === '===' || trimmed === '___') {
      if (inUl) { outLines.push('</ul>'); inUl = false }
      if (inOl) { outLines.push('</ol>'); inOl = false }
      outLines.push('<hr>')
      return
    }

    // Bullet item
    const bulletMatch = line.match(/^(\s*)[•\-\*]\s+(.*)$/)
    if (bulletMatch) {
      if (inOl) { outLines.push('</ol>'); inOl = false }
      if (!inUl) { outLines.push('<ul>'); inUl = true }
      outLines.push(`<li>${bulletMatch[2]}</li>`)
      return
    }

    // Numbered item
    const numMatch = line.match(/^(\s*)\d+[\.\)]\s+(.*)$/)
    if (numMatch) {
      if (inUl) { outLines.push('</ul>'); inUl = false }
      if (!inOl) { outLines.push('<ol>'); inOl = true }
      outLines.push(`<li>${numMatch[2]}</li>`)
      return
    }

    // Normal line
    if (inUl) { outLines.push('</ul>'); inUl = false }
    if (inOl) { outLines.push('</ol>'); inOl = false }

    if (trimmed.length === 0) {
      outLines.push('<div><br></div>')
    } else {
      outLines.push(`<div>${line}</div>`)
    }
  })

  if (inUl) outLines.push('</ul>')
  if (inOl) outLines.push('</ol>')

  return outLines.join('')
}

/**
 * Converts DOM HTML back to Markdown string for clean Firestore storage
 */
function htmlToMarkdown(html: string): string {
  if (!html) return ''

  const temp = document.createElement('div')
  temp.innerHTML = html

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || ''
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return ''
    }

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()

    let inner = ''
    el.childNodes.forEach(child => {
      inner += processNode(child)
    })

    switch (tag) {
      case 'b':
      case 'strong':
        return inner ? `**${inner}**` : ''
      case 'i':
      case 'em':
        return inner ? `*${inner}*` : ''
      case 'u':
        return inner ? `<u>${inner}</u>` : ''
      case 's':
      case 'strike':
      case 'del':
        return inner ? `~~${inner}~~` : ''
      case 'hr':
        return '\n---\n'
      case 'li':
        return inner ? `• ${inner}\n` : ''
      case 'ul':
      case 'ol':
        return `\n${inner}\n`
      case 'br':
        return '\n'
      case 'div':
      case 'p':
        return inner === '<br>' || inner === '' ? '\n' : `\n${inner}`
      default:
        return inner
    }
  }

  let result = processNode(temp)
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return result
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Type details here (use toolbar for bold, italic, lists)...',
  className = '',
  minHeight = 'min-h-[5rem]',
  compact = false
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const isInternalChangeRef = useRef(false)

  // Active command states
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)
  const [isStrike, setIsStrike] = useState(false)
  const [isList, setIsList] = useState(false)

  // Sync value to contentEditable on external change
  useEffect(() => {
    if (!editorRef.current) return
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false
      return
    }

    const currentMd = htmlToMarkdown(editorRef.current.innerHTML)
    if (currentMd !== value) {
      editorRef.current.innerHTML = markdownToHtml(value)
    }
  }, [value])

  const updateActiveStates = useCallback(() => {
    try {
      setIsBold(document.queryCommandState('bold'))
      setIsItalic(document.queryCommandState('italic'))
      setIsUnderline(document.queryCommandState('underline'))
      setIsStrike(document.queryCommandState('strikeThrough'))
      setIsList(document.queryCommandState('insertUnorderedList') || document.queryCommandState('insertOrderedList'))
    } catch {
      // ignore
    }
  }, [])

  const handleInput = () => {
    if (!editorRef.current) return
    isInternalChangeRef.current = true
    const md = htmlToMarkdown(editorRef.current.innerHTML)
    onChange(md)
    updateActiveStates()
  }

  const exec = (command: string, value: string = '') => {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand(command, false, value)
    handleInput()
    updateActiveStates()
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all ${className}`}>
      
      {/* Visual Format Toolbar */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-slate-50 border-b border-slate-200 select-none overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 shrink-0">
          {/* Bold */}
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); exec('bold') }}
            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-black transition cursor-pointer ${
              isBold
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-700 hover:bg-white hover:text-indigo-600 border border-transparent hover:border-slate-200'
            }`}
            title="Bold (Ctrl+B) - text turns bold visually"
          >
            B
          </button>

          {/* Italic */}
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); exec('italic') }}
            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs italic font-serif transition cursor-pointer ${
              isItalic
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-700 hover:bg-white hover:text-indigo-600 border border-transparent hover:border-slate-200'
            }`}
            title="Italic (Ctrl+I) - text turns italic visually"
          >
            I
          </button>

          {/* Underline */}
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); exec('underline') }}
            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs underline font-bold transition cursor-pointer ${
              isUnderline
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-700 hover:bg-white hover:text-indigo-600 border border-transparent hover:border-slate-200'
            }`}
            title="Underline (Ctrl+U) - text is underlined visually"
          >
            U
          </button>

          {/* Strikethrough */}
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); exec('strikeThrough') }}
            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs line-through font-bold transition cursor-pointer ${
              isStrike
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-700 hover:bg-white hover:text-indigo-600 border border-transparent hover:border-slate-200'
            }`}
            title="Strikethrough"
          >
            S
          </button>

          <span className="h-4 w-px bg-slate-300 mx-1" />

          {/* Bullet List */}
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList') }}
            className={`px-2 h-7 flex items-center gap-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              isList
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-700 hover:bg-white hover:text-indigo-600 border border-transparent hover:border-slate-200'
            }`}
            title="Bulleted List"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h.01M4 12h.01M4 18h.01M8 6h12M8 12h12M8 18h12" />
            </svg>
            {!compact && <span className="text-[10px] hidden sm:inline">Bullet</span>}
          </button>

          {/* Numbered List */}
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); exec('insertOrderedList') }}
            className="px-2 h-7 flex items-center gap-1 rounded-lg text-xs font-bold text-slate-700 hover:bg-white hover:text-indigo-600 border border-transparent hover:border-slate-200 transition cursor-pointer"
            title="Numbered List"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 6h13M7 12h13M7 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
            {!compact && <span className="text-[10px] hidden sm:inline">List</span>}
          </button>

          {/* Divider Line */}
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); exec('insertHorizontalRule') }}
            className="px-2 h-7 flex items-center gap-1 rounded-lg text-xs font-bold text-slate-700 hover:bg-white hover:text-indigo-600 border border-transparent hover:border-slate-200 transition cursor-pointer"
            title="Divider Line"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" />
            </svg>
            {!compact && <span className="text-[10px] hidden sm:inline">Divider</span>}
          </button>
        </div>

        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
          Rich Visual Mode
        </span>
      </div>

      {/* Visual ContentEditable Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyUp={updateActiveStates}
        onMouseUp={updateActiveStates}
        data-placeholder={placeholder}
        className={`p-3 text-xs sm:text-sm text-slate-800 focus:outline-hidden leading-relaxed ${minHeight} empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none`}
        style={{ wordBreak: 'break-word' }}
      />
    </div>
  )
}
