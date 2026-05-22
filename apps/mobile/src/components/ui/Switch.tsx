import { Switch as RNSwitch } from 'react-native';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Switch({ checked, onCheckedChange }: SwitchProps) {
  return (
    <RNSwitch
      value={checked}
      onValueChange={onCheckedChange}
      trackColor={{ false: '#374151', true: '#2a1636' }}
      thumbColor={checked ? '#a78bfa' : '#9ca3af'}
    />
  );
}
