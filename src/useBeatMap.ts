import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from './store'
import { buildBeatMap, loadCompleteSnapshot, saveCompleteSnapshot, type BeatMapSnapshot, type ScoreBeatMap } from './beatMap'

/**
 * 从总谱状态派生节拍图：音符重切、评论重锚、分谱换页与声部校验。
 * 时值变化后整图自动重算；重切失败时保留上一张完整图。
 */
export function useBeatMap(cueCount = 2): { beatMap: ScoreBeatMap; lastComplete: BeatMapSnapshot | null } {
  const tracks = useSelector((state: RootState) => state.score.tracks)
  const comments = useSelector((state: RootState) => state.score.comments)
  const [lastComplete, setLastComplete] = useState<BeatMapSnapshot | null>(() => loadCompleteSnapshot())

  const beatMap = useMemo(() => buildBeatMap(tracks, comments, cueCount), [tracks, comments, cueCount])

  useEffect(() => {
    if (beatMap.complete) {
      saveCompleteSnapshot(beatMap)
      setLastComplete(loadCompleteSnapshot())
    }
  }, [beatMap])

  return { beatMap, lastComplete }
}
