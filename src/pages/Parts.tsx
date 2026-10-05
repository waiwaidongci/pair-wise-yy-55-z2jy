import { useState } from 'react'
import { Alert, Button, InputNumber, Select, Space, Switch, Tag } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import { useSelector } from 'react-redux'
import type { RootState } from '../store'
import { computePageBreaks } from '../beatMap'
import { useBeatMap } from '../useBeatMap'

export default function Parts() {
  const tracks = useSelector((state: RootState) => state.score.tracks)
  const [trackId, setTrackId] = useState(tracks[0]!.id)
  const [cue, setCue] = useState(true)
  const [pageTurn, setPageTurn] = useState(2)
  const track = tracks.find((item) => item.id === trackId)!
  const { beatMap } = useBeatMap()
  const trackMap = beatMap.tracks.find((item) => item.trackId === trackId)!
  const breaks = computePageBreaks(trackMap.completeMeasures, pageTurn)
  const breakAfter = new Map(breaks.map((item) => [item.afterMeasure, item]))
  const cueMeasures = new Set(breaks.flatMap((item) => item.cueMeasures))
  const cueSource = tracks[(tracks.indexOf(track) + 1) % tracks.length]!
  return <main className="page">
    <div className="page-head no-print"><div><p className="eyebrow">分谱提取与出版排版</p><h1>演奏者分谱预览</h1><p>从总谱提取独立声部，按 4/4 拍重切后的小节调整换页、提示音、排练标记与打印分页。</p></div><Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>打印分谱</Button></div>
    <div className="panel no-print" style={{marginBottom:16}}><Space wrap><Select value={trackId} style={{width:180}} options={tracks.map((item)=>({value:item.id,label:`${item.name} · ${item.instrument}`}))} onChange={setTrackId} /><span>换页前提示音：</span><InputNumber min={0} max={8} value={pageTurn} onChange={(value)=>setPageTurn(value ?? 0)} /><span>小节</span><Switch checked={cue} onChange={setCue} checkedChildren="显示提示音" unCheckedChildren="隐藏提示音" /><Tag color={track.transposition ? 'purple' : 'blue'}>{track.transposition ? `移调 ${track.transposition}` : '不移调'}</Tag><Tag color={trackMap.failure ? 'red' : 'green'}>{trackMap.failure ? `重切失败 · 从第 ${trackMap.failure.resumeFromMeasure} 小节继续` : `${trackMap.completeMeasures} 个完整小节`}</Tag></Space></div>
    {trackMap.failure && <Alert className="no-print" type="error" showIcon style={{marginBottom:16}} message={`${track.name} 第 ${trackMap.measures[trackMap.measures.length - 1]?.index} 小节不完整（${trackMap.failure.beats}/4 拍）`} description="重切失败后的音符未进入分谱；已保留上一张完整图，修复时值后换页与提示音会自动重算。" />}
    <article className="part-page">
      <div style={{display:'flex',justifyContent:'space-between',borderBottom:'2px solid #0f172a',paddingBottom:10}}><div><h1 style={{margin:0,fontFamily:'serif'}}>{track.name}</h1><small>{track.instrument} · 移调后记谱分谱</small></div><div style={{textAlign:'right'}}><b>《潮汐线》</b><div>沈青 作品</div><div>出版稿 v12</div></div></div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:10}}><b>I. 潮起 · ♩ = 72</b><span>1</span></div>
      {trackMap.measures.map((measure) => <div key={measure.index}>
        <div className={`part-measure ${measure.complete ? '' : 'incomplete'}`} style={{gridTemplateColumns:`repeat(${Math.max(measure.notes.length, 1)},1fr)`}}>
          {measure.notes.map(({ note, noteIndex }, index) => <div key={note.id} className="part-note"><b>{note.key.replace('/', '')}</b><small style={{display:'block',color:'#64748b'}}>{note.dynamic}{note.tie ? ' ⁀' : ''}</small>{cue && index===0 && cueMeasures.has(measure.index) && <em style={{display:'block',fontSize:10,color:'#2563eb'}}>提示：{cueSource.name}</em>}{index===0 && <small style={{display:'block',fontSize:10,color:'#94a3b8'}}>第 {measure.index} 小节 · {measure.beats}/4 拍</small>}</div>)}
        </div>
        {!measure.complete && <div style={{textAlign:'right',color:'#dc2626',fontSize:12}}>第 {measure.index} 小节不完整（{measure.beats}/4 拍）· 出版检查不能通过</div>}
        {breakAfter.has(measure.index) && <div className="page-break-marker"><span>换页 → 第 {breakAfter.get(measure.index)!.beforeMeasure} 小节起新页{pageTurn > 0 ? ` · 换页前 ${pageTurn} 小节提示音（第 ${breakAfter.get(measure.index)!.cueMeasures.join('、')} 小节）` : ''}</span></div>}
      </div>)}
      <div style={{marginTop:30,borderTop:'1px solid #94a3b8',paddingTop:10,color:'#64748b',fontSize:11}}>© 2026 云谱出版社 · 仅限排练使用 · 禁止未授权复制</div>
    </article>
  </main>
}
