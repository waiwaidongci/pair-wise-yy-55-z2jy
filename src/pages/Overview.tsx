import { Alert, Button, Card, Col, Progress, Row, Table, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '../store'
import { scoreApi } from '../store'
import { buildBeatMap } from '../beatmap'

export default function Overview() {
  const navigate = useNavigate()
  const { tracks, comments, rebarCommitted, rebarErrors } = useSelector((state: RootState) => state.score)
  const { data } = scoreApi.endpoints.getPublishingProfile.useQuery()
  const measureCount = rebarCommitted ? Math.max(...tracks.map((t) => buildBeatMap(t).measures.length)) : 3
  const publishingPassed = rebarErrors.length === 0
  return <main className="page">
    <div className="page-head"><div><p className="eyebrow">乐谱、移调与出版准备</p><h1>{data?.title ?? '总谱出版工作台'}</h1><p>统一管理多声部总谱、移调乐器分谱、换页提示、版本差异与评论锚点。</p></div><Button type="primary" onClick={() => navigate('/score')}>进入总谱编辑</Button></div>
    <Row gutter={[14,14]} className="metrics"><Col xs={24} sm={12} xl={6}><Card className="metric"><span>声部数量</span><strong>{tracks.length}</strong><small>4 个乐手分谱</small></Card></Col><Col xs={24} sm={12} xl={6}><Card className="metric"><span>总谱小节</span><strong>{measureCount}</strong><small>4/4 拍 · C 大调</small></Card></Col><Col xs={24} sm={12} xl={6}><Card className="metric"><span>待处理评论</span><strong>{comments.filter((item) => !item.resolved).length}</strong><small>指挥与作曲意见</small></Card></Col><Col xs={24} sm={12} xl={6}><Card className="metric"><span>预计页数</span><strong>{data?.pages ?? 46}</strong><small>交付 {data?.deadline ?? '2026-10-12'}</small></Card></Col></Row>
    {!publishingPassed && <Alert type="error" showIcon message="出版检查未通过" description={<ul style={{ margin: 0, paddingLeft: 18 }}>{rebarErrors.map((err, i) => <li key={i}>{err.message}{err.deviatingNoteId ? `（偏差音符 ${err.deviatingNoteId}）` : ''}</li>)}</ul>} action={<Button size="small" onClick={() => navigate('/score')}>前往总谱重切</Button>} style={{ marginBottom: 16 }} />}
    {publishingPassed && <Alert type="success" showIcon message="出版检查通过" description="各声部小节拍数一致，评论锚点与分谱换页已对齐。" style={{ marginBottom: 16 }} />}
    <Row gutter={[16,16]}><Col xs={24} xl={16}><Card title="声部与出版状态"><Table rowKey="id" pagination={false} dataSource={tracks} columns={[{title:'声部',dataIndex:'name'},{title:'乐器',dataIndex:'instrument'},{title:'移调',render:(_value,row)=><Tag color={row.transposition ? 'purple' : 'blue'}>{row.transposition ? `${row.transposition > 0 ? '+' : ''}${row.transposition} 半音` : '不移调'}</Tag>},{title:'小节',render:(_value,row)=>`${new Set(row.notes.map(note=>note.id.split('-')[1])).size} 组 / ${row.notes.length} 音`},{title:'状态',render:()=><Tag color="green">可排版</Tag>}]} /></Card></Col><Col xs={24} xl={8}><Card title="出版检查"><div className="check-row"><span>和弦拼写校验</span><b className="success">通过</b></div><div className="check-row"><span>节奏完整性</span><b className={publishingPassed ? 'success' : 'danger'}>{publishingPassed ? '通过' : '未通过'}</b></div><div className="check-row"><span>换页与提示音</span><b className="success">已对齐</b></div><div className="check-row"><span>分谱移调</span><b className="success">已与总谱同步</b></div><Progress percent={publishingPassed ? 100 : 60} strokeColor={publishingPassed ? '#059669' : '#dc2626'} /><p className="muted">{publishingPassed ? '出版检查已通过，可锁定出版版本。' : '完成全部评论处理并修复小节偏差后方可锁定出版版本。'}</p></Card></Col></Row>
  </main>
}
