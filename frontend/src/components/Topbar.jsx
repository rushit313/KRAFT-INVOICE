import { useNavigate } from 'react-router-dom';
import { Plus, FileText, ShoppingCart } from 'lucide-react';

export default function Topbar({ title, subtitle, actions }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a32] bg-kraft-surface/80 backdrop-blur-sm flex-shrink-0">
      <div>
        <h1 className="text-lg font-bold text-white">{title}</h1>
        {subtitle && <p className="text-xs text-[#666670] mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions?.map((action, i) => (
          <button
            key={i}
            onClick={action.onClick}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
              ${action.danger
                ? 'bg-red-950/30 text-kraft-red border border-red-900/40 hover:bg-red-900/50 hover:text-white'
                : action.primary
                  ? 'bg-kraft-accent text-kraft-bg hover:bg-kraft-accent/90'
                  : 'bg-kraft-surface2 text-[#aaaaaa] hover:text-white border border-[#2e2e36]'
              }`}
          >
            {action.icon && <action.icon size={14} />}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
