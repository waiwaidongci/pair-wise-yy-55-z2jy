import type { ScoreComment, ScoreNote, Track } from './types'

/**
 * 节拍图（beat map）：按 4/4 拍累计时值重切小节，
 * 并把音符、评论锚点与分谱换页接到同一张图上。
 */

export const BEATS_PER_MEASURE = 4
export const MEASURES_PER_PAGE = 4
export const NOTE_BEATS: Record<ScoreNote['duration'], number> = { q: 1, h: 2, '8': 0.5 }

/** 旧方案：每 4 个音符切一小节（勘误前的错位切法） */
export const LEGACY_NOTES_PER_MEASURE = 4

export interface MeasureNote {
  note: ScoreNote
  /** 音符在声部中的原始序号（0 起），评论与换页据此跟随原音符 */
  noteIndex: number
  /** 音符在小节内的起拍（0 起，单位：拍） */
  beatOffset: number
}

export interface Measure {
  /** 小节号（1 起） */
  index: number
  notes: MeasureNote[]
  /** 小节总拍数；完整小节恒等于 BEATS_PER_MEASURE */
  beats: number
  /** 小节起始在全曲的累计拍位置 */
  startBeat: number
  complete: boolean
}

export interface CutFailure {
  reason: 'overflow' | 'incomplete'
  /** overflow：跨不过小节线的音符序号；incomplete：残段首个音符序号 */
  noteIndex: number | null
  note: ScoreNote | null
  /** 失败小节已累积的拍数 */
  beats: number
  /** 恢复点：最后完整小节的编号，重切从这里继续 */
  resumeFromMeasure: number
}

export interface TrackBeatMap {
  trackId: string
  trackName: string
  measures: Measure[]
  /** 完整小节数（不含失败残段） */
  completeMeasures: number
  failure: CutFailure | null
  totalBeats: number
  /** 音符序号 -> 小节号（1 起），未落入任何小节的音符缺席 */
  noteMeasure: Record<number, number>
}

/** 按 4/4 拍累计时值，把一个声部的音符重切成小节 */
export function cutTrackMeasures(track: Track): TrackBeatMap {
  const measures: Measure[] = []
  const noteMeasure: Record<number, number> = {}
  let current: MeasureNote[] = []
  let beats = 0
  let startBeat = 0
  let failure: CutFailure | null = null

  const closeMeasure = (complete: boolean) => {
    const index = measures.length + 1
    current.forEach((item) => { noteMeasure[item.noteIndex] = index })
    measures.push({ index, notes: current, beats, startBeat, complete })
    startBeat += beats
    current = []
    beats = 0
  }

  for (let i = 0; i < track.notes.length; i++) {
    const note = track.notes[i]!
    const noteBeats = NOTE_BEATS[note.duration]
    if (beats + noteBeats > BEATS_PER_MEASURE) {
      // 音符跨不过小节线：重切失败，保留已切出的完整小节
      const failedBeats = beats
      if (current.length) closeMeasure(false)
      failure = { reason: 'overflow', noteIndex: i, note, beats: failedBeats, resumeFromMeasure: measures.filter((m) => m.complete).length }
      break
    }
    current.push({ note, noteIndex: i, beatOffset: beats })
    beats += noteBeats
    if (beats === BEATS_PER_MEASURE) closeMeasure(true)
  }
  if (!failure && current.length) {
    // 末尾音符凑不满一小节：残段不完整，重切失败
    closeMeasure(false)
    const last = measures[measures.length - 1]!
    failure = {
      reason: 'incomplete',
      noteIndex: last.notes[0]?.noteIndex ?? null,
      note: last.notes[0]?.note ?? null,
      beats: last.beats,
      resumeFromMeasure: measures.filter((m) => m.complete).length,
    }
  }

  return {
    trackId: track.id,
    trackName: track.name,
    measures,
    completeMeasures: measures.filter((m) => m.complete).length,
    failure,
    totalBeats: measures.reduce((sum, m) => sum + m.beats, 0),
    noteMeasure,
  }
}

export interface AnchoredComment extends ScoreComment {
  /** 评论跟随的原音符序号（按旧切法的小节首音） */
  anchorNoteIndex: number
  /** 重切后的新小节号；无法锚定时为 null */
  anchoredMeasure: number | null
  orphaned: boolean
}

/** 评论锚点重算：旧小节号 -> 原音符 -> 新小节号，评论跟着原音符进新小节 */
export function anchorComments(comments: ScoreComment[], reference: TrackBeatMap, noteCount: number): AnchoredComment[] {
  return comments.map((comment) => {
    const anchorNoteIndex = (comment.measure - 1) * LEGACY_NOTES_PER_MEASURE
    const anchoredMeasure = reference.noteMeasure[anchorNoteIndex] ?? null
    return { ...comment, anchorNoteIndex, anchoredMeasure, orphaned: anchoredMeasure === null || anchorNoteIndex >= noteCount }
  })
}

export interface PageBreak {
  /** 在此完整小节之后换页 */
  afterMeasure: number
  beforeMeasure: number
  /** 换页前提示音所在的小节号（跟随原音符重排后的位置） */
  cueMeasures: number[]
}

/** 分谱换页重算：每 MEASURES_PER_PAGE 个完整小节换一页，提示音取换页前 cueCount 个小节 */
export function computePageBreaks(completeMeasures: number, cueCount: number): PageBreak[] {
  const breaks: PageBreak[] = []
  for (let after = MEASURES_PER_PAGE; after < completeMeasures; after += MEASURES_PER_PAGE) {
    const cues: number[] = []
    for (let m = Math.max(1, after - cueCount + 1); m <= after; m++) cues.push(m)
    breaks.push({ afterMeasure: after, beforeMeasure: after + 1, cueMeasures: cueCount > 0 ? cues : [] })
  }
  return breaks
}

export interface VoiceDeviation {
  trackId: string
  trackName: string
  /** 该声部在偏差小节的总拍数（小节缺失为 0） */
  beats: number
  /** 偏差音符：与参考声部累计时值首次分叉的音符 */
  note: ScoreNote
  noteIndex: number
  detail: string
}

export interface MeasureMismatch {
  measureIndex: number
  referenceBeats: number
  deviations: VoiceDeviation[]
}

interface DivergenceOnset {
  noteIndex: number
  note: ScoreNote
  detail: string
}

/** 与参考声部逐音累计时值，找出每次分叉的首个音符 */
function divergenceOnsets(reference: ScoreNote[], target: ScoreNote[]): DivergenceOnset[] {
  const onsets: DivergenceOnset[] = []
  let cumRef = 0
  let cumTarget = 0
  let diverged = false
  const length = Math.max(reference.length, target.length)
  for (let i = 0; i < length; i++) {
    const ref = reference[i]
    const got = target[i]
    if (ref) cumRef += NOTE_BEATS[ref.duration]
    if (got) cumTarget += NOTE_BEATS[got.duration]
    if (cumRef !== cumTarget && !diverged) {
      diverged = true
      if (got && ref) onsets.push({ noteIndex: i, note: got, detail: `时值 ${got.duration} ≠ 参考 ${ref.duration}` })
      else if (got) onsets.push({ noteIndex: i, note: got, detail: '参考声部之外多出的音符' })
      else onsets.push({ noteIndex: Math.max(0, target.length - 1), note: target[target.length - 1]!, detail: `缺少参考声部第 ${i + 1} 个音符` })
    } else if (cumRef === cumTarget) {
      diverged = false
    }
  }
  return onsets
}

/**
 * 声部间校验：同一小节拍数必须一致（以首声部为参考）。
 * 不一致时标出声部与偏差音符；一处偏差只报首次分叉的小节，避免级联噪声。
 */
export function checkMeasureConsistency(trackMaps: TrackBeatMap[], tracks: Track[]): MeasureMismatch[] {
  const reference = trackMaps[0]
  const referenceTrack = tracks[0]
  if (!reference || !referenceTrack) return []
  const mismatches = new Map<number, MeasureMismatch>()
  const referenceMeasureCount = reference.measures.length

  trackMaps.slice(1).forEach((map, voiceOffset) => {
    const track = tracks[voiceOffset + 1]!
    const onsets = divergenceOnsets(referenceTrack.notes, track.notes)
    if (!onsets.length) return
    const onset = onsets[0]!
    const measureIndex = reference.noteMeasure[onset.noteIndex]
      ?? map.noteMeasure[onset.noteIndex]
      ?? referenceMeasureCount + 1
    const referenceBeats = reference.measures.find((m) => m.index === measureIndex)?.beats ?? 0
    const beats = map.measures.find((m) => m.index === measureIndex)?.beats ?? 0
    const deviation: VoiceDeviation = {
      trackId: map.trackId,
      trackName: map.trackName,
      beats,
      note: onset.note,
      noteIndex: onset.noteIndex,
      detail: onset.detail,
    }
    const existing = mismatches.get(measureIndex)
    if (existing) existing.deviations.push(deviation)
    else mismatches.set(measureIndex, { measureIndex, referenceBeats, deviations: [deviation] })
  })
  return [...mismatches.values()].sort((a, b) => a.measureIndex - b.measureIndex)
}

export interface ScoreBeatMap {
  tracks: TrackBeatMap[]
  comments: AnchoredComment[]
  pageBreaks: PageBreak[]
  mismatches: MeasureMismatch[]
  failures: { trackId: string; trackName: string; failure: CutFailure }[]
  /** 全图完整（可过出版检查） */
  complete: boolean
  /** 全曲恢复点：各声部最后完整小节的最小值 */
  resumeFromMeasure: number
  measureCount: number
}

/** 把四个声部、评论与分谱换页接成一张节拍图 */
export function buildBeatMap(tracks: Track[], comments: ScoreComment[], cueCount = 2): ScoreBeatMap {
  const trackMaps = tracks.map(cutTrackMeasures)
  const reference = trackMaps[0]
  const noteCount = tracks[0]?.notes.length ?? 0
  const anchored = reference ? anchorComments(comments, reference, noteCount) : []
  const completeMeasures = reference?.completeMeasures ?? 0
  const mismatches = checkMeasureConsistency(trackMaps, tracks)
  const failures = trackMaps.filter((map) => map.failure).map((map) => ({ trackId: map.trackId, trackName: map.trackName, failure: map.failure! }))
  return {
    tracks: trackMaps,
    comments: anchored,
    pageBreaks: computePageBreaks(completeMeasures, cueCount),
    mismatches,
    failures,
    complete: mismatches.length === 0 && failures.length === 0,
    resumeFromMeasure: trackMaps.length ? Math.min(...trackMaps.map((map) => map.completeMeasures)) : 0,
    measureCount: completeMeasures,
  }
}

/* ---- 上一张完整图：重切失败时保留，便于从最后完整小节恢复 ---- */

const SNAPSHOT_KEY = 'yy55-beat-map-complete'

export interface BeatMapSnapshot {
  savedAt: string
  measureCount: number
  tracks: { trackId: string; trackName: string; measures: { index: number; beats: number; noteIds: string[] }[] }[]
  comments: { id: string; anchoredMeasure: number | null }[]
}

export function saveCompleteSnapshot(map: ScoreBeatMap) {
  if (!map.complete) return
  try {
    const snapshot: BeatMapSnapshot = {
      savedAt: new Date().toISOString(),
      measureCount: map.measureCount,
      tracks: map.tracks.map((track) => ({
        trackId: track.trackId,
        trackName: track.trackName,
        measures: track.measures.filter((m) => m.complete).map((m) => ({ index: m.index, beats: m.beats, noteIds: m.notes.map((n) => n.note.id) })),
      })),
      comments: map.comments.map((comment) => ({ id: comment.id, anchoredMeasure: comment.anchoredMeasure })),
    }
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    /* localStorage 不可用时静默跳过 */
  }
}

export function loadCompleteSnapshot(): BeatMapSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    return raw ? (JSON.parse(raw) as BeatMapSnapshot) : null
  } catch {
    return null
  }
}
