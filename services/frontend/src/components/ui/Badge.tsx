// src/components/ui/Badge.tsx

interface BadgeProps {
  variant:
    | "todo"
    | "in_progress"
    | "done"
    | "low"
    | "medium"
    | "high";
  children: React.ReactNode;
}

const variantClasses: Record<string, string> = {
  todo: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
};

export default function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5
        text-xs font-medium ${variantClasses[variant] || ""}`}
    >
      {children}
    </span>
  );
}
