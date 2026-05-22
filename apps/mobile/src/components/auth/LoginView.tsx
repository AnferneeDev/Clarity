import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '@/hooks/useAuth';

export default function LoginView() {
  const { login, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        const result = await signUp(email.trim(), password);
        if (!result.success) setError(result.error || 'Sign up failed');
        else setError('Check your email to confirm your account.');
      } else {
        await login(email.trim(), password);
      }
    } catch (e: any) {
      setError(e.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-black"
    >
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-4xl font-bold text-white mb-2">Clarity</Text>
        <Text className="text-white/60 text-lg mb-8">Modern Pomodoro Timer</Text>

        <View className="w-full max-w-sm gap-4">
          <TextInput
            className="bg-white/10 border border-gray-700/30 rounded-xl px-4 py-3 text-white text-base"
            placeholder="Email"
            placeholderTextColor="#6b7280"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextInput
            className="bg-white/10 border border-gray-700/30 rounded-xl px-4 py-3 text-white text-base"
            placeholder="Password"
            placeholderTextColor="#6b7280"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          {error ? (
            <Text className={`text-sm text-center ${error.includes('Check your email') ? 'text-green-400' : 'text-red-400'}`}>
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            className="bg-[#2a1636] rounded-xl py-3 items-center"
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-lg font-medium">
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setError(''); }}>
            <Text className="text-white/60 text-sm text-center">
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
