import React from 'react'

interface FormattedTextProps {
  text?: string | null
  className?: string
  as?: 'div' | 'p' | 'span'
}

/**
 * Parses inline formatting tags (**bold**, *italic*, <u>underline</u>, ~~strike~~, [links])
 */
export function parseInlineFormatting(str: string): React.ReactNode[] {
  if (!str) return []

  // Tokenize string for markdown patterns
  // Order: Links, Bold (**), Underline (<u> or __), Strike (~~), Italic (* or _)
  const tokens: React.ReactNode[] = []
  
  // Regex to match bold, underline tags, strike, markdown links, or italic
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|<u>(.*?)<\/u>|__([^_]+)__|~~([^~]+)~~|\*([^*]+)\*|_([^_]+)_|<br\s*\/?>)/gi

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(str)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      tokens.push(str.substring(lastIndex, match.index))
    }

    const [
      fullMatch,
      , linkText, linkUrl,
      boldText,
      underlineHtml,
      underlineMd,
      strikeText,
      italicStar,
      italicUnder,
    ] = match

    const key = `tok_${match.index}_${tokens.length}`

    if (linkText && linkUrl) {
      tokens.push(
        <a
          key={key}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800 font-semibold"
          onClick={e => e.stopPropagation()}
        >
          {linkText}
        </a>
      )
    } else if (boldText !== undefined) {
      tokens.push(
        <strong key={key} className="font-black text-slate-900">
          {boldText}
        </strong>
      )
    } else if (underlineHtml !== undefined || underlineMd !== undefined) {
      tokens.push(
        <u key={key} className="underline underline-offset-2 decoration-slate-400">
          {underlineHtml || underlineMd}
        </u>
      )
    } else if (strikeText !== undefined) {
      tokens.push(
        <del key={key} className="line-through text-slate-400">
          {strikeText}
        </del>
      )
    } else if (italicStar !== undefined || italicUnder !== undefined) {
      tokens.push(
        <em key={key} className="italic">
          {italicStar || italicUnder}
        </em>
      )
    } else if (fullMatch.toLowerCase().startsWith('<br')) {
      tokens.push(<br key={key} />)
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < str.length) {
    tokens.push(str.substring(lastIndex))
  }

  return tokens
}

/**
 * Component that renders rich formatted text with block and inline support:
 * - **bold**
 * - *italic*
 * - <u>underline</u>
 * - ~~strikethrough~~
 * - --- (horizontal divider line)
 * - • or - (bullet points)
 * - 1. (numbered lists)
 */
export const FormattedText: React.FC<FormattedTextProps> = ({
  text,
  className = '',
  as = 'div'
}) => {
  if (!text) return null

  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  let inList: 'ul' | 'ol' | null = null
  let listItems: React.ReactNode[] = []

  const flushList = () => {
    if (inList === 'ul') {
      elements.push(
        <ul key={`ul_${elements.length}`} className="list-disc pl-5 space-y-1 my-1.5 text-inherit leading-relaxed">
          {listItems}
        </ul>
      )
    } else if (inList === 'ol') {
      elements.push(
        <ol key={`ol_${elements.length}`} className="list-decimal pl-5 space-y-1 my-1.5 text-inherit leading-relaxed">
          {listItems}
        </ol>
      )
    }
    inList = null
    listItems = []
  }

  lines.forEach((line, idx) => {
    const trimmed = line.trim()

    // Horizontal Rule / Divider Line: --- or ===
    if (trimmed === '---' || trimmed === '===' || trimmed === '___') {
      flushList()
      elements.push(
        <hr key={`hr_${idx}`} className="my-3 border-t border-slate-200" />
      )
      return
    }

    // Bullet item (- or * or •)
    const bulletMatch = line.match(/^(\s*)[•\-\*]\s+(.*)$/)
    if (bulletMatch) {
      if (inList !== 'ul') {
        flushList()
        inList = 'ul'
      }
      listItems.push(
        <li key={`li_${idx}`}>
          {parseInlineFormatting(bulletMatch[2])}
        </li>
      )
      return
    }

    // Numbered item (1. or 1) )
    const numberedMatch = line.match(/^(\s*)\d+[\.\)]\s+(.*)$/)
    if (numberedMatch) {
      if (inList !== 'ol') {
        flushList()
        inList = 'ol'
      }
      listItems.push(
        <li key={`li_${idx}`}>
          {parseInlineFormatting(numberedMatch[2])}
        </li>
      )
      return
    }

    // Normal line
    flushList()

    if (trimmed.length === 0) {
      elements.push(<div key={`sp_${idx}`} className="h-1.5" />)
    } else {
      elements.push(
        <p key={`p_${idx}`} className="leading-relaxed">
          {parseInlineFormatting(line)}
        </p>
      )
    }
  })

  flushList()

  const Component = as as any
  return <Component className={className}>{elements}</Component>
}

interface FormatToolbarProps {
  targetRef?: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>
  value: string
  onChange: (val: string) => void
  className?: string
  compact?: boolean
}

/**
 * Interactive Toolbar for applying formatting (Bold, Italic, Underline, Strikethrough, Line, Bullet)
 */
export const FormatToolbar: React.FC<FormatToolbarProps> = ({
  targetRef,
  value,
  onChange,
  className = '',
  compact = false
}) => {
  const applyFormat = (prefix: string, suffix: string = prefix, defaultPlaceholder: string = 'text') => {
    const input = targetRef?.current
    if (!input) {
      onChange(value ? `${value}\n${prefix}${defaultPlaceholder}${suffix}` : `${prefix}${defaultPlaceholder}${suffix}`)
      return
    }

    const start = input.selectionStart ?? value.length
    const end = input.selectionEnd ?? value.length
    const selectedText = value.substring(start, end)
    const replacement = selectedText ? `${prefix}${selectedText}${suffix}` : `${prefix}${defaultPlaceholder}${suffix}`

    const newValue = value.substring(0, start) + replacement + value.substring(end)
    onChange(newValue)

    // Restore focus and selection
    setTimeout(() => {
      input.focus()
      const newCursorStart = start + prefix.length
      const newCursorEnd = start + prefix.length + (selectedText ? selectedText.length : defaultPlaceholder.length)
      input.setSelectionRange(newCursorStart, newCursorEnd)
    }, 10)
  }

  const insertBlock = (snippet: string) => {
    const input = targetRef?.current
    if (!input) {
      onChange(value ? `${value}\n${snippet}` : snippet)
      return
    }

    const start = input.selectionStart ?? value.length
    const end = input.selectionEnd ?? value.length
    const needLeadingNewline = start > 0 && value[start - 1] !== '\n' ? '\n' : ''
    const textToInsert = `${needLeadingNewline}${snippet}`

    const newValue = value.substring(0, start) + textToInsert + value.substring(end)
    onChange(newValue)

    setTimeout(() => {
      input.focus()
      const pos = start + textToInsert.length
      input.setSelectionRange(pos, pos)
    }, 10)
  }

  return (
    <div className={`flex items-center gap-0.5 bg-slate-100/90 border border-slate-200/90 p-1 rounded-lg text-slate-600 ${className}`}>
      {/* Bold */}
      <button
        type="button"
        onClick={() => applyFormat('**', '**', 'bold text')}
        title="Bold (**text**)"
        className="px-2 py-1 hover:bg-white hover:text-slate-900 rounded font-black text-xs transition cursor-pointer"
      >
        B
      </button>

      {/* Italic */}
      <button
        type="button"
        onClick={() => applyFormat('*', '*', 'italic text')}
        title="Italic (*text*)"
        className="px-2 py-1 hover:bg-white hover:text-slate-900 rounded italic font-serif text-xs transition cursor-pointer"
      >
        I
      </button>

      {/* Underline */}
      <button
        type="button"
        onClick={() => applyFormat('<u>', '</u>', 'underlined text')}
        title="Underline (<u>text</u>)"
        className="px-2 py-1 hover:bg-white hover:text-slate-900 rounded underline font-bold text-xs transition cursor-pointer"
      >
        U
      </button>

      {/* Strikethrough */}
      <button
        type="button"
        onClick={() => applyFormat('~~', '~~', 'strikethrough text')}
        title="Strikethrough (~~text~~)"
        className="px-2 py-1 hover:bg-white hover:text-slate-900 rounded line-through text-xs font-bold transition cursor-pointer"
      >
        S
      </button>

      <span className="h-3.5 w-px bg-slate-300 mx-1" />

      {/* Horizontal Divider Line */}
      <button
        type="button"
        onClick={() => insertBlock('---\n')}
        title="Divider Line (---)"
        className="px-2 py-1 hover:bg-white hover:text-slate-900 rounded text-xs font-bold transition cursor-pointer flex items-center gap-0.5"
      >
        <span>―</span>
        {!compact && <span className="text-[10px] text-slate-500 font-normal">Line</span>}
      </button>

      {/* Bullet List */}
      <button
        type="button"
        onClick={() => insertBlock('• ')}
        title="Bullet Point (• )"
        className="px-2 py-1 hover:bg-white hover:text-slate-900 rounded text-xs font-bold transition cursor-pointer flex items-center gap-0.5"
      >
        <span>•</span>
        {!compact && <span className="text-[10px] text-slate-500 font-normal">Bullet</span>}
      </button>

      {/* Numbered List */}
      <button
        type="button"
        onClick={() => insertBlock('1. ')}
        title="Numbered List (1. )"
        className="px-2 py-1 hover:bg-white hover:text-slate-900 rounded text-xs font-bold transition cursor-pointer flex items-center gap-0.5"
      >
        <span className="text-[11px]">1.</span>
        {!compact && <span className="text-[10px] text-slate-500 font-normal">List</span>}
      </button>
    </div>
  )
}
