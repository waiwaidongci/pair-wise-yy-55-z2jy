import { useEffect, useRef } from 'react'
import { Alert, Button, Divider, Segmented, Select, Space, Tag, Tooltip } from 'antd'
import { DeleteOutlined, PlusOutlined, RedoOutlined, UndoOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow'
import type { AppDispatch, RootState } from '../store'
import { addNote, redo, removeNote, selectNote, selectTrack, transposeTrack, undo, updateNote } from '../store'
import { useBeatMap } from '../useBeatMap'

export default function ScoreEditor() {
  const dispatch = useDispatch<AppDispatch>()
  const { tracks, selectedTrackId, selectedNoteIndex, history, future, dirty } = useSelector((state: RootState) => state.score)
  const track = tracks.find((item) => item.id === selectedTrackId)!
  const note = track.notes[selectedNoteIndex]
  const { beatMap, lastComplete } = useBeatMap()
  const trackMap = beatMap.tracks.find((item) => item.trackId === selectedTrackId)!
  const scoreRef = useRef<HTMLDivElement>(null)

  const trackDeviations = beatMap.mismatches.flatMap((item) => item.deviations).filter((item) => item.trackId === selectedTrackId)
  const deviationNotes = new Set(trackDeviations.map((item) => item.noteIndex))
  const failure = trackMap.failure
  const unplacedFrom = failure?.reason === 'overflow' ? failure.noteIndex : null

  useEffect(() => {
    const element = scoreRef.current
    if (!element) return
    element.innerHTML = ''
    const renderer = new Renderer(element, Renderer.Backends.SVG)
    const measures = trackMap.measures
    renderer.resize(Math.max(1060, measures.length * 340 + 20), 230)
    const context = renderer.getContext()
    measures.forEach((measure, index) => {
      const stave = new Stave(index * 340, 22, 320).addClef(track.clef)
      if (index === 0) stave.addTimeSignature('4/4')
      stave.setContext(context).draw()
      const staveNotes = measure.notes.map(({ note: item }) => {
        const staveNote = new StaveNote({ keys: [item.key], duration: item.duration })
        if (item.accidental) staveNote.addModifier(new Accidental(item.accidental), 0)
        return staveNote
      })
      if (staveNotes.length) {
        const voice = new Voice({ num_beats: measure.beats, beat_value: 4 })
        if (!measure.complete) voice.setStrict(false)
        voice.addTickables(staveNotes)
        new Formatter().joinVoices([voice]).format([voice], 275)
        voice.draw(context, stave)
      }
      context.setFont('Arial', 11, 'normal').fillText(track.name, index * 340 + 10, 15)
      if (track.transposition) context.fillText(`移调 ${track.transposition > 0 ? '+' : ''}${track.transposition}`, index * 340 + 210, 15)
      context.setFont('Arial', 10, measure.complete ? 'normal' : 'bold')
      const label = `第 ${measure.index} 小节 · ${measure.beats}/4 拍${measure.complete ? '' : ' · 不完整'}`
      if (measure.complete) context.fillText(label, index * 340 + 10, 218)
      else { context.save(); context.setFillStyle('#dc2626'); context.fillText(label, index * 340 + 10, 218); context.restore() }
    })
  }, [track, trackMap])

  const update = (patch: Parameters<typeof updateNote>[0] extends never ? never : Record<string, unknown>) => dispatch(updateNote(patch as never))
  return <main className="page">
    <div className="page-head"><div><p className="eyebrow">五线谱编辑与移调</p><h1>多声部总谱</h1><p>按 4/4 拍累计时值重切小节；选择音符后可编辑时值、力度、连音、表情和移调；所有操作支持撤销重做。</p></div><Space><Tag color={dirty ? 'orange' : 'green'}>{dirty ? '有未保存修改' : '已保存'}</Tag><Tooltip title="撤销"><Button icon={<UndoOutlined />} disabled={!history.length} onClick={() => dispatch(undo())} /></Tooltip><Tooltip title="重做"><Button icon={<RedoOutlined />} disabled={!future.length} onClick={() => dispatch(redo())} /></Tooltip></Space></div>
    <div className="score-toolbar"><Segmented value={selectedTrackId} options={tracks.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => dispatch(selectTrack(String(value)))} /><span style={{flex:1}} /><Button onClick={() => dispatch(transposeTrack(-1))}>降半音</Button><Button onClick={() => dispatch(transposeTrack(1))}>升半音</Button><Select value={track.transposition} style={{width:120}} options={[-12,-7,-5,-2,0,2,5,7,12].map((value)=>({value,label:`移调 ${value > 0 ? '+' : ''}${value}`}))} onChange={(value) => dispatch(transposeTrack(value - track.transposition))} /></div>
    <Alert type="info" showIcon message={`${track.instrument} · ${track.clef === 'treble' ? '高音谱号' : track.clef === 'bass' ? '低音谱号' : '中音谱号'}`} description="当前显示移调后的实际记谱音高。移调仅改变音高，不改变时值，节拍图不受移调影响。" style={{ marginBottom: 12 }} />
    {failure && <Alert type="error" showIcon style={{ marginBottom: 12 }}
      message={`重切失败：${failure.reason === 'overflow' ? `音符 ${failure.note?.id ?? ''}（${failure.note?.key ?? ''}）跨不过小节线` : `末尾残段只有 ${failure.beats}/4 拍`}，已保留上一张完整图`}
      description={`${track.name} 已切出 ${trackMap.completeMeasures} 个完整小节，从第 ${failure.resumeFromMeasure} 小节（最后完整小节）继续。${lastComplete ? `上一张完整图保存于 ${new Date(lastComplete.savedAt).toLocaleString('zh-CN')}，共 ${lastComplete.measureCount} 小节。` : '暂无完整图快照。'}`} />}
    {beatMap.mismatches.length > 0 && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="声部间小节拍数不一致，出版检查不能通过" description={beatMap.mismatches.map((item) => <div key={item.measureIndex}>第 {item.measureIndex} 小节（参考 {item.referenceBeats}/4 拍）：{item.deviations.map((dev) => `${dev.trackName} ${dev.beats}/4 拍，偏差音符 ${dev.note.id}（${dev.note.key}，${dev.detail}）`).join('；')}</div>)} />}
    <div className="score-grid">
      <section><div className="score-canvas-wrap" ref={scoreRef} /><div className="note-strip">{track.notes.map((item,index)=><button key={item.id} className={`note-chip ${index===selectedNoteIndex?'active':''} ${deviationNotes.has(index) || (unplacedFrom !== null && index >= unplacedFrom) ? 'error' : ''}`} onClick={()=>dispatch(selectNote(index))}><b>{index+1}</b><small>{item.key.replace('/', '')} · {item.dynamic}</small><small className="note-chip-measure">小节 {trackMap.noteMeasure[index] ?? '—'}</small></button>)}</div><Space wrap><Button icon={<PlusOutlined />} onClick={()=>dispatch(addNote())}>添加音符</Button><Button danger icon={<DeleteOutlined />} onClick={()=>dispatch(removeNote())}>删除当前</Button><Button onClick={()=>update({ duration: note?.duration === 'q' ? 'h' : note?.duration === 'h' ? '8' : 'q' })}>切换时值</Button><Button onClick={()=>update({ tie: !note?.tie })}>{note?.tie ? '取消延音' : '增加延音'}</Button><Button onClick={()=>update({ accidental: note?.accidental ? undefined : '#' })}>{note?.accidental ? '移除临时记号' : '增加升号'}</Button></Space></section>
      <aside className="panel"><h3>音符属性</h3><label>力度</label><Select value={note?.dynamic} style={{width:'100%'}} options={['pp','p','mp','mf','f','ff'].map((value)=>({value,label:value}))} onChange={(value)=>update({ dynamic:value })} /><label>表情标记</label><Select value={note?.expression} allowClear style={{width:'100%'}} options={[{value:'dolce',label:'dolce 柔和地'},{value:'cantabile',label:'cantabile 如歌地'},{value:'marcato',label:'marcato 着重地'}]} onChange={(value)=>update({ expression:value ?? '' })} /><Divider /><h3>节拍图校验</h3><div className="check-row"><span>小节拍数（4/4 累计）</span>{failure ? <b className="danger">第 {trackMap.measures[trackMap.measures.length - 1]?.index} 小节 {failure.beats}/4 拍</b> : <b className="success">完整</b>}</div><div className="check-row"><span>声部节拍一致性</span>{beatMap.mismatches.length ? <b className="danger">{beatMap.mismatches.length} 处不一致</b> : <b className="success">一致</b>}</div><div className="check-row"><span>评论锚点</span>{beatMap.comments.filter((item) => item.orphaned).length ? <b className="warning">{beatMap.comments.filter((item) => item.orphaned).length} 条失效</b> : <b className="success">已重锚</b>}</div><div className="check-row"><span>出版检查</span>{beatMap.complete ? <b className="success">通过</b> : <b className="danger">不通过</b>}</div>{trackDeviations.map((item) => <Alert key={`${item.noteIndex}`} type="warning" showIcon message={`偏差音符 ${item.note.id}（${item.note.key}）`} description={item.detail} style={{ marginTop: 14 }} />)}</aside>
    </div>
  </main>
}
