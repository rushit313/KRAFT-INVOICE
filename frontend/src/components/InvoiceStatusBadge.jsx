export default function InvoiceStatusBadge({ status }) {
  const map = {
    draft:   { label: 'Draft',   bg: 'bg-gray-800',   text: 'text-gray-400',  dot: 'bg-gray-500'  },
    unpaid:  { label: 'Unpaid',  bg: 'bg-red-950/60', text: 'text-red-400',   dot: 'bg-red-500'   },
    partial: { label: 'Partial', bg: 'bg-amber-950/60',text: 'text-amber-400',dot: 'bg-amber-500' },
    paid:    { label: 'Paid',    bg: 'bg-green-950/60',text: 'text-green-400', dot: 'bg-green-500' },
    overdue: { label: 'Overdue', bg: 'bg-orange-950/60',text: 'text-orange-400',dot: 'bg-orange-500'},
  };
  const s = map[status] || map.unpaid;
  return (
    <span className={`badge ${s.bg} ${s.text}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
