// components/ui/checkbox.tsx
import * as React from "react";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className = "", onCheckedChange, onChange, ...props }, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    onCheckedChange?.(e.target.checked);
  };

  return <input type="checkbox" className={`h-4 w-4 rounded border-gray-300 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] ${className}`} ref={ref} onChange={handleChange} {...props} />;
});
Checkbox.displayName = "Checkbox";

export { Checkbox };
