import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateFebBoxToken } from '../services/febbox';
import { TokenState } from '../types';

const TOKENS_STORAGE_KEY = '@febbox_tokens';

export const useFebBoxTokens = () => {
  const [tokens, setTokens] = useState<TokenState[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTokens();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      saveTokens();
    }
  }, [tokens, isLoading]);

  const loadTokens = async () => {
    try {
      const stored = await AsyncStorage.getItem(TOKENS_STORAGE_KEY);
      if (stored) {
        const savedTokens: string[] = JSON.parse(stored);
        
        const initialTokens = savedTokens.map((value: string) => ({
          value,
          status: 'validating' as const,
        }));
        setTokens(initialTokens);
        setIsLoading(false);

        const validationPromises = savedTokens.map(async (token, index) => {
          const result = await validateFebBoxToken(token.trim());
          return { index, result };
        });

        const validations = await Promise.all(validationPromises);

        setTokens(prev => {
          const updated = [...prev];
          validations.forEach(({ index, result }) => {
            updated[index] = {
              value: savedTokens[index],
              status: result.isValid ? 'valid' : 'invalid',
              data: result.data,
            };
          });
          return updated;
        });
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error loading tokens:', error);
      setIsLoading(false);
    }
  };

  const saveTokens = async () => {
    try {
      const nonEmptyTokens = tokens
        .filter(token => token.value.trim() !== '')
        .map(token => token.value);
      await AsyncStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(nonEmptyTokens));
    } catch (error) {
      console.error('Error saving tokens:', error);
    }
  };

  const addToken = () => {
    setTokens([...tokens, { value: '', status: 'idle' }]);
  };

  const updateToken = async (index: number, value: string) => {
    const newTokens = [...tokens];
    newTokens[index] = { value, status: 'validating' };
    setTokens(newTokens);

    if (value.trim() !== '') {
      const result = await validateFebBoxToken(value.trim());
      
      const updatedTokens = [...tokens];
      updatedTokens[index] = {
        value,
        status: result.isValid ? 'valid' : 'invalid',
        data: result.data,
      };
      setTokens(updatedTokens);
    } else {
      const updatedTokens = [...tokens];
      updatedTokens[index] = { value: '', status: 'idle' };
      setTokens(updatedTokens);
    }
  };

  const removeToken = (index: number) => {
    setTokens(tokens.filter((_, i) => i !== index));
  };

  return {
    tokens,
    isLoading,
    addToken,
    updateToken,
    removeToken,
  };
};