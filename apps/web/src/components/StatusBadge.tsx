export type StatusType = 
  | 'PROPOSED' | 'VALIDATED' | 'EXECUTING' | 'EXECUTION_UNKNOWN' 
  | 'VERIFIED_SUCCESS' | 'VERIFIED_FAILURE' | 'BLOCKED' | 'ESCALATED';

interface StatusBadgeProps {
  status: StatusType | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  let bgColor = 'bg-surface';
  let textColor = 'text-text-main';
  let dotColor = 'bg-text-muted';

  switch (status) {
    case 'PROPOSED':
    case 'VALIDATED':
      bgColor = 'bg-blue-500/10';
      textColor = 'text-blue-400';
      dotColor = 'bg-blue-500';
      break;
    case 'EXECUTING':
    case 'VERIFYING':
      bgColor = 'bg-primary-muted';
      textColor = 'text-primary';
      dotColor = 'bg-primary animate-pulse';
      break;
    case 'VERIFIED_SUCCESS':
      bgColor = 'bg-emerald-500/10';
      textColor = 'text-emerald-400';
      dotColor = 'bg-emerald-500';
      break;
    case 'BLOCKED':
    case 'VERIFIED_FAILURE':
      bgColor = 'bg-rose-500/10';
      textColor = 'text-rose-400';
      dotColor = 'bg-rose-500';
      break;
    case 'EXECUTION_UNKNOWN':
    case 'ESCALATED':
      bgColor = 'bg-purple-500/10';
      textColor = 'text-purple-400';
      dotColor = 'bg-purple-500';
      break;
  }

  return (
    <span className={`inline-flex items-center space-x-2 px-2.5 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor} border border-current/10`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
      <span>{status}</span>
    </span>
  );
}
