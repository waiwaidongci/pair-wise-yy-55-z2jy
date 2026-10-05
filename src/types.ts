export interface ScoreNote {
  id: string
  key: string
  duration: 'q' | 'h' | '8'
  accidental?: '#' | 'b' | 'n'
  dynamic: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff'
  tie: boolean
  expression: string
}

export interface Track {
  id: string
  name: string
  instrument: string
  clef: 'treble' | 'bass' | 'alto'
  transposition: number
  color: string
  pageTurn: number
  pageTurnNoteId: string
  notes: ScoreNote[]
}

export interface ScoreComment {
  id: string
  trackId?: string
  noteId?: string
  measure: number
  author: string
  content: string
  resolved: boolean
}

export interface ScoreVersion {
  id: string
  author: string
  time: string
  summary: string
  trackNotes: Record<string, ScoreNote[]>
}
