import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type TripStartHeaderProps = {
  nickname: string;
  isEditing?: boolean;
};

export function TripStartHeader({ nickname, isEditing = false }: TripStartHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {isEditing
          ? '\uC5EC\uD589 \uC815\uBCF4 \uC218\uC815'
          : `${nickname}\uB2D8,\n\uC5EC\uD589\uC744 \uC2DC\uC791\uD574\uBCFC\uAE4C\uC694?`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 100,
    marginBottom: 28,
    paddingHorizontal: 6,
  },
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 20,
    lineHeight: 28,
    color: '#162018',
  },
});
