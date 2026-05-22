import { TouchableOpacity, Text, ActivityIndicator, type TouchableOpacityProps } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  variant?: 'primary' | 'secondary' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
  className?: string;
  textClassName?: string;
}

export function Button({ variant = 'primary', size = 'md', loading, children, className = '', textClassName = '', disabled, ...props }: ButtonProps) {
  const base = 'items-center justify-center rounded-xl';
  const variants: Record<string, string> = {
    primary: 'bg-[#2a1636]',
    secondary: 'bg-white/10 border border-gray-700/50',
    destructive: 'bg-red-600',
  };
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5',
    md: 'px-5 py-2.5',
    lg: 'px-6 py-3',
  };
  const textSizes: Record<string, string> = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <TouchableOpacity
      className={`${base} ${variants[variant]} ${sizes[size]} ${disabled || loading ? 'opacity-50' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <Text className={`text-white font-medium text-center ${textSizes[size]} ${textClassName}`}>
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
}
