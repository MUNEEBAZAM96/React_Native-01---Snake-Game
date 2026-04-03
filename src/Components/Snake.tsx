import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Coordinates } from '../Type/GestureEventtype';
import colours from '../Styles/colours';

interface SnakeProps {
  snake: Coordinates[];
  food: Coordinates;
  cellWidth: number;
  cellHeight: number;
}

/**
 * Snake + food are drawn in grid cells. Positions are clamped by Game logic to stay inside walls.
 */
export default function Snake({
  snake,
  food,
  cellWidth,
  cellHeight,
}: SnakeProps): React.ReactElement {
  const r = Math.min(cellWidth, cellHeight) * 0.15;
  return (
    <>
      {snake.map((segment, index) => (
        <View
          key={`${segment.x}-${segment.y}-${index}`}
          style={[
            styles.segment,
            {
              left: segment.x * cellWidth,
              top: segment.y * cellHeight,
              width: cellWidth,
              height: cellHeight,
              borderRadius: r,
              backgroundColor: index === 0 ? colours.tertiary : colours.secondary,
            },
          ]}
        />
      ))}
      <View
        style={[
          styles.segment,
          {
            left: food.x * cellWidth,
            top: food.y * cellHeight,
            width: cellWidth,
            height: cellHeight,
            borderRadius: r,
            backgroundColor: colours.primary,
            borderWidth: 2,
            borderColor: colours.tertiary,
          },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  segment: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: colours.primary,
  },
});
