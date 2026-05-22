import { Modal as RNModal, View, TouchableOpacity, Text, Pressable } from 'react-native';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ visible, onClose, title, children }: ModalProps) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60 justify-center items-center p-6" onPress={onClose}>
        <Pressable onPress={e => e.stopPropagation()}>
          <View className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm p-5">
            {title && <Text className="text-white text-lg font-semibold mb-4">{title}</Text>}
            {children}
            <TouchableOpacity onPress={onClose} className="mt-4 items-center">
              <Text className="text-white/60 text-sm">Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
