import { CircleAlert } from 'lucide-react';

export function ApiError({ error }) {
  const data = error?.data;
  return <div className="notice error"><CircleAlert size={18} /><div><strong>{data?.error || 'REQUEST_FAILED'}</strong><span>{data?.message || 'The service could not complete this request.'}</span></div></div>;
}