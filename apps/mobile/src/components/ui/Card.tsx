import { View, Text, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <View className={`bg-white/5 border border-gray-700/30 rounded-2xl ${className}`} {...props}>
      {children}
    </View>
  );
}

export function CardContent({ children, className = '', ...props }: ViewProps) {
  return <View className={`p-4 ${className}`} {...props}>{children}</View>;
}

export function CardFooter({ children, className = '', ...props }: ViewProps) {
  return <View className={`px-4 pb-4 ${className}`} {...props}>{children}</View>;
}

export function CardHeader({ children, className = '', ...props }: ViewProps) {
  return <View className={`px-4 pt-4 ${className}`} {...props}>{children}</View>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <Text className={`text-xl font-semibold text-white ${className}`}>{children}</Text>;
}
