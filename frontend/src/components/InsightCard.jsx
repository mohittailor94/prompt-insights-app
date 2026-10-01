import { memo } from 'react';
import { Lightbulb } from 'lucide-react';

export const InsightCard = memo(function InsightCard({ insight, index }) {
  return <article className="insight-card" style={{ '--delay': `${index * 55}ms` }}><div className="card-top"><span className="eyebrow">{String(index + 1).padStart(2, '0')} / {insight.category}</span><span className="confidence">{insight.confidence}% match</span></div><h3>{insight.title}</h3><p>{insight.detail}</p><div className="card-foot"><span className="confidence-bar"><i style={{ width: `${insight.confidence}%` }} /></span><Lightbulb size={16} /></div></article>;
});