import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Category, RootStackParamList } from '../../types';
import { COLORS, SPACING, FONT_SIZES } from '../../constants';

import { PosterCard } from './PosterCard';
import { SkeletonCard } from './SkeletonCard';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  category: Category;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Horizontal scrolling row of movie/TV posters
 * Shows loading skeletons while data is being fetched
 */
export const CategoryRow: React.FC<Props> = ({ category }) => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{category.title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {category.loading ? (
          // Show 5 skeleton cards while loading
          Array(5)
            .fill(0)
            .map((_, i) => <SkeletonCard key={i} />)
        ) : (
          // Show actual poster cards
          category.items.map((item) => (
            <PosterCard 
              key={item.id} 
              item={item}
              onPress={() => navigation.navigate('Detail', { item })}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 25,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginLeft: SPACING.lg,
    marginBottom: 12,
  },
  row: {
    paddingLeft: SPACING.lg,
    paddingRight: 10,
  },
});