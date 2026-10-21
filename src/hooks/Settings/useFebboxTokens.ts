import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { validateFebBoxToken } from '../../services/febbox';
import { TokenState } from '../../types';

const TOKENS_STORAGE_KEY = '@febbox_tokens';

export const useFebBoxTokens = () => {
  const [tokens, setTokens] = useState<TokenState[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const saveTokens = useCallback(async () => {
    try {
      const nonEmptyTokens = tokens
        .filter(token => token.value && token.value.trim() !== '')
        .map(token => token.value.trim());
      await AsyncStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(nonEmptyTokens));
      console.log('[useFebboxTokens] Saved to AsyncStorage:', nonEmptyTokens.length, 'tokens');
    } catch (error) {
      console.error('Error saving tokens:', error);
    }
  }, [tokens]);

  const addToken = () => {
    setTokens(prev => [...prev, { value: '', status: 'idle' }]);
  };

  const updateToken = async (index: number, value: string) => {
    const trimmed = value.trim();
    console.log(`[useFebboxTokens] updateToken called at index ${index}, length: ${value.length}`);

    setTokens(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { value, status: 'validating' };
      }
      return next;
    });

    if (trimmed !== '') {
      const result = await validateFebBoxToken(trimmed);
      console.log(`[useFebboxTokens] Token #${index} validation result:`, JSON.stringify(result));
      setTokens(prev => {
        const next = [...prev];
        if (next[index]) {
          next[index] = {
            value: trimmed,
            status: result.isValid ? 'valid' : 'invalid',
            data: result.data,
          };
        }
        return next;
      });
    } else {
      setTokens(prev => {
        const next = [...prev];
        if (next[index]) {
          next[index] = { value: '', status: 'idle' };
        }
        return next;
      });
    }
  };

  const removeToken = (index: number) => {
    console.log(`[useFebboxTokens] Removing token at index ${index}`);
    setTokens(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    loadTokens();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      saveTokens();
    }
  }, [tokens, isLoading, saveTokens]);

  return {
    tokens,
    isLoading,
    addToken,
    updateToken,
    removeToken,
  };
};