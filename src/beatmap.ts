import type { ScoreComment, ScoreNote, Track } from './types'

export const BEATS_PER_MEASURE = 4

export function durationBeats(duration: ScoreNote['duration']): number {
  return duration === 'h' ? 2 : duration === 'q' ? 1 : 0.5
}

export interface BeatMapMeasure {
  index: number
  notes: ScoreNote[]
  beats: number
  complete: boolean
  overflow: boolean
}

export interface BeatMap {
  trackId: string
  measures: BeatMapMeasure[]
  complete: boolean
  overflow: boolean
  failedMeasure: number
  deviatingNoteId: string | null
}

export function buildBeatMap(track: Track): BeatMap {
  const measures: BeatMapMeasure[] = []
  let current: ScoreNote[] = []
  let beats = 0
  let overflow = false
  let failedMeasure = -1
  let deviatingNoteId: string | null = null

  const flush = (isOverflow: boolean) => {
    if (current.length === 0) return
    measures.push({ index: measures.length, notes: current, beats, complete: beats === BEATS_PER_MEASURE, overflow: isOverflow })
    current = []
    beats = 0
  }

  for (const note of track.notes) {
    const b = durationBeats(note.duration)
    if (beats + b > BEATS_PER_MEASURE) {
      if (!overflow) {
        overflow = true
        failedMeasure = measures.length
        deviatingNoteId = note.id
      }
      flush(true)
      current = [note]
      beats = b
    } else {
      current.push(note)
      beats += b
      if (beats === BEATS_PER_MEASURE) flush(false)
    }
  }
  if (current.length > 0) flush(false)

  return { trackId: track.id, measures, complete: !overflow, overflow, failedMeasure, deviatingNoteId }
}

export interface BeatMapError {
  trackId: string
  trackName: string
  measureIndex: number
  deviatingNoteId: string | null
  reason: 'overflow' | 'measure-count' | 'beat-mismatch'
  message: string
}

export function validateBeatMaps(beatMaps: BeatMap[], tracks: Track[]): BeatMapError[] {
  const errors: BeatMapError[] = []
  if (beatMaps.length === 0) return errors

  const measureCounts = new Set(beatMaps.map((bm) => bm.measures.length))
  if (measureCounts.size > 1) {
    errors.push({ trackId: '', trackName: '', measureIndex: -1, deviatingNoteId: null, reason: 'measure-count', message: '声部间小节数不一致' })
  }

  const maxMeasures = Math.max(...beatMaps.map((bm) => bm.measures.length))
  for (let m = 0; m < maxMeasures; m++) {
    const beatValues = new Set<number>()
    for (const bm of beatMaps) {
      const measure = bm.measures[m]
      beatValues.add(measure ? measure.beats : -1)
    }
    if (beatValues.size > 1) {
      for (const bm of beatMaps) {
        const measure = bm.measures[m]
        const track = tracks.find((t) => t.id === bm.trackId)
        if (!track) continue
        if (!measure || measure.beats !== BEATS_PER_MEASURE) {
          errors.push({
            trackId: bm.trackId,
            trackName: track.name,
            measureIndex: m,
            deviatingNoteId: measure?.notes[0]?.id ?? null,
            reason: 'beat-mismatch',
            message: `${track.name} 第 ${m + 1} 小节为 ${measure?.beats ?? 0} 拍（应为 4 拍）`,
          })
        }
      }
    }
  }

  for (const bm of beatMaps) {
    if (bm.overflow) {
      const track = tracks.find((t) => t.id === bm.trackId)
      if (!track) continue
      errors.push({
        trackId: bm.trackId,
        trackName: track.name,
        measureIndex: bm.failedMeasure,
        deviatingNoteId: bm.deviatingNoteId,
        reason: 'overflow',
        message: `${track.name} 第 ${bm.failedMeasure + 1} 小节出现越界音符`,
      })
    }
  }

  return errors
}

export function reanchorComments(comments: ScoreComment[], tracks: Track[]): ScoreComment[] {
  return comments.map((comment) => {
    if (!comment.noteId) return comment
    const track = comment.trackId
      ? tracks.find((t) => t.id === comment.trackId)
      : tracks.find((t) => t.notes.some((n) => n.id === comment.noteId))
    if (!track) return comment
    const beatMap = buildBeatMap(track)
    const measureIndex = beatMap.measures.findIndex((m) => m.notes.some((n) => n.id === comment.noteId))
    if (measureIndex < 0) return comment
    return { ...comment, measure: measureIndex + 1 }
  })
}

export function recomputePageTurns(tracks: Track[]): Track[] {
  return tracks.map((track) => {
    if (!track.pageTurnNoteId) return track
    const beatMap = buildBeatMap(track)
    const newMeasureIndex = beatMap.measures.findIndex((m) => m.notes.some((n) => n.id === track.pageTurnNoteId))
    if (newMeasureIndex < 0) return track
    return { ...track, pageTurn: newMeasureIndex + 1 }
  })
}
