import { TextInput, type TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  className?: string;
}

export function Input({ className = '', style, ...props }: InputProps) {
  return (
    <TextInput
      className={`bg-white/10 border border-gray-700/30 rounded-xl px-4 py-3 text-white text-base ${className}`}
      placeholderTextColor="#6b7280"
      style={[{ outline: 'none' }, style as any]}
      {...props}
    />
  );
}
