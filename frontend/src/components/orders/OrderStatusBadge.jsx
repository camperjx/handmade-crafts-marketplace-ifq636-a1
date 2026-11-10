const labels = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', completed: 'Completed' };
export default function OrderStatusBadge({ status }) { return <span className={`order-badge ${labels[status] ? status : ''}`}>{labels[status] || 'Unavailable'}</span>; }
