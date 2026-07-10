import { useId, useState } from 'react'
import { Input } from '~/components/ui/input'

// Tag entry: type + Enter (or comma) adds a chip; suggestions come from a
// native datalist so there's no dropdown machinery to maintain.
export function ChipsInput({
  value,
  onChange,
  suggestions,
  placeholder,
  inputId,
}: {
  value: string[]
  onChange: (next: string[]) => void
  suggestions: string[]
  placeholder?: string
  inputId?: string
}) {
  const listId = useId()
  const [draft, setDraft] = useState('')

  function commit(raw: string) {
    const cleaned = raw.trim().replace(/,+$/, '')
    if (!cleaned) return
    if (!value.includes(cleaned) && value.length < 10) onChange([...value, cleaned])
    setDraft('')
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((chip) => (
            <span
              key={chip}
              className="label-mono border-ink bg-secondary inline-flex items-center gap-1.5 border px-2 py-1">
              {chip}
              <button
                type="button"
                aria-label={`Remove ${chip}`}
                className="hover:text-destructive font-sans"
                onClick={() => onChange(value.filter((c) => c !== chip))}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        id={inputId}
        list={listId}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => {
          if (e.target.value.endsWith(',')) commit(e.target.value)
          else setDraft(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit(draft)
          }
        }}
        onBlur={() => commit(draft)}
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  )
}
