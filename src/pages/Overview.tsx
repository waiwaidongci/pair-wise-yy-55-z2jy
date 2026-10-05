import { Alert, Button, Card, Col, Progress, Row, Table, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '../store'
import { scoreApi } from '../store'
import { useBeatMap } from '../useBeatMap'

export default function Overview() {
  const navigate = useNavigate()
  const tracks = useSelector((state: RootState) => state.score.tracks)
  const comments = useSelector((state: RootState) => state.score.comments)
  const { data } = scoreApi.endpoints.getPublishingProfile.useQuery()
  const { beatMap, lastComplete } = useBeatMap()
  const orphaned = beatMap.comments.filter((item) => item.orphaned).length
  const checks = [
    { label: '节奏完整性（4/4 累计重切）', pass: beatMap.failures.length === 0, passText: '通过', failText: `${beatMap.failures.length} 个声部重切失败` },
    { label: '声部节拍一致性', pass: beatMap.mismatches.length === 0, passText: '通过', failText: `${beatMap.mismatches.length} 处不一致` },
    { label: '评论锚点重锚', pass: orphaned === 0, passText: '通过', failText: `${orphaned} 条锚点失效` },
    { label: '换页与提示音', pass: beatMap.failures.length === 0, passText: beatMap.pageBreaks.length ? `通过 · ${beatMap.pageBreaks.length} 处换页` : '通过 · 无需换页', failText: '重切完成后重算' },
  ]
  const passed = checks.filter((item) => item.pass).length
  return <main className="page">
    <div className="page-head"><div><p className="eyebrow">乐谱、移调与出版准备</p><h1>{data?.title ?? '总谱出版工作台'}</h1><p>统一管理多声部总谱、移调乐器分谱、换页提示、版本差异与评论锚点。</p></div><Button type="primary" onClick={() => navigate('/score')}>进入总谱编辑</Button></div>
    <Row gutter={[14,14]} className="metrics"><Col xs={24} sm={12} xl={6}><Card className="metric"><span>声部数量</span><strong>{tracks.length}</strong><small>4 个乐手分谱</small></Card></Col><Col xs={24} sm={12} xl={6}><Card className="metric"><span>总谱小节</span><strong>{beatMap.measureCount}</strong><small>4/4 拍 · 按时值累计重切</small></Card></Col><Col xs={24} sm={12} xl={6}><Card className="metric"><span>待处理评论</span><strong>{comments.filter((item) => !item.resolved).length}</strong><small>指挥与作曲意见</small></Card></Col><Col xs={24} sm={12} xl={6}><Card className="metric"><span>预计页数</span><strong>{data?.pages ?? 46}</strong><small>交付 {data?.deadline ?? '2026-10-12'}</small></Card></Col></Row>
    {!beatMap.complete && <Alert type="error" showIcon message="出版检查不能通过：节拍图重切未完整" style={{ marginBottom: 16 }} description={<div>
      {beatMap.failures.map((item) => <div key={item.trackId}>{item.trackName}：{item.failure.reason === 'overflow' ? `音符 ${item.failure.note?.id}（${item.failure.note?.key}）跨不过小节线` : `末尾残段 ${item.failure.beats}/4 拍`}，从第 {item.failure.resumeFromMeasure} 小节（最后完整小节）继续。</div>)}
      {beatMap.mismatches.map((item) => <div key={item.measureIndex}>第 {item.measureIndex} 小节拍数不一致（参考 {item.referenceBeats}/4 拍）：{item.deviations.map((dev) => `${dev.trackName} ${dev.beats}/4 拍 · 偏差音符 ${dev.note.id}（${dev.note.key}）`).join('；')}</div>)}
      {lastComplete && <div style={{ marginTop: 6, color: '#667085' }}>已保留上一张完整图：{lastComplete.measureCount} 小节 · 保存于 {new Date(lastComplete.savedAt).toLocaleString('zh-CN')}</div>}
    </div>} action={<Button size="small" onClick={() => navigate('/score')}>去修复</Button>} />}
    <Alert type="warning" showIcon message="轮次差异需要处理" description="圆号第 2 小节力度与现行出版稿不一致；单簧管分谱第 6 小节换页提示尚未确认。" action={<Button size="small" onClick={() => navigate('/versions')}>查看差异</Button>} style={{ marginBottom: 16 }} />
    <Row gutter={[16,16]}><Col xs={24} xl={16}><Card title="声部与出版状态"><Table rowKey="id" pagination={false} dataSource={tracks} columns={[{title:'声部',dataIndex:'name'},{title:'乐器',dataIndex:'instrument'},{title:'移调',render:(_value,row)=><Tag color={row.transposition ? 'purple' : 'blue'}>{row.transposition ? `${row.transposition > 0 ? '+' : ''}${row.transposition} 半音` : '不移调'}</Tag>},{title:'小节（4/4 重切）',render:(_value,row)=>{ const map = beatMap.tracks.find((item) => item.trackId === row.id)!; return <span>{map.completeMeasures} 完整{map.failure ? ` · 残段 ${map.failure.beats}/4 拍` : ''} / {row.notes.length} 音</span> }},{title:'状态',render:(_value,row)=>{ const map = beatMap.tracks.find((item) => item.trackId === row.id)!; return map.failure ? <Tag color="red">重切失败</Tag> : <Tag color="green">可排版</Tag> }}]} /></Card></Col><Col xs={24} xl={8}><Card title="出版检查">{checks.map((item) => <div className="check-row" key={item.label}><span>{item.label}</span>{item.pass ? <b className="success">{item.passText}</b> : <b className="danger">{item.failText}</b>}</div>)}<Progress percent={Math.round((passed / checks.length) * 100)} strokeColor={beatMap.complete ? '#16a34a' : '#2563eb'} /><p className="muted">{beatMap.complete ? '节拍图完整，可锁定出版版本。' : '完成全部评论处理并修复节拍图后方可锁定出版版本。'}</p></Card></Col></Row>
  </main>
}
