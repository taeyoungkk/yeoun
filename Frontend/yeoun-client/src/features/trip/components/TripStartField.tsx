import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type IconName = keyof typeof MaterialIcons.glyphMap;

type TripStartFieldProps = {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  rightSlot?: React.ReactNode;
  centerSlot?: React.ReactNode;
};

type TripStartInputFieldProps = {
  icon: IconName;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
};

export function TripStartField({
  icon,
  label,
  value,
  onPress,
  rightSlot,
  centerSlot,
}: TripStartFieldProps) {
  return (
    <Pressable style={styles.field} onPress={onPress}>
      <View style={styles.sideSlot}>
        <MaterialIcons name={icon} size={18} color="#82909A" />
      </View>

      <View style={styles.centerContent}>
        {centerSlot ? (
          centerSlot
        ) : (
          <Text
            style={[styles.value, !value && styles.placeholder]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {value || label}
          </Text>
        )}
      </View>

      <View style={styles.sideSlot}>{rightSlot}</View>
    </Pressable>
  );
}

export function TripStartInputField({
  icon,
  placeholder,
  value,
  onChangeText,
}: TripStartInputFieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.sideSlot}>
        <MaterialIcons name={icon} size={18} color="#82909A" />
      </View>

      <View style={styles.centerContent}>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor="#98A2AB"
          value={value}
          onChangeText={onChangeText}
          style={styles.input}
          textAlign="center"
        />
      </View>

      <View style={styles.sideSlot} />
    </View>
  );
}

export function TripMemberCounter({
  count,
  onDecrease,
  onIncrease,
}: {
  count: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <View style={styles.counterWrap}>
      <TouchableOpacity style={styles.counterButton} onPress={onDecrease} activeOpacity={0.8}>
        <MaterialIcons name="remove" size={16} color="#5D6967" />
      </TouchableOpacity>

      <Text style={styles.counterValue}>{count}명</Text>

      <TouchableOpacity style={styles.counterButton} onPress={onIncrease} activeOpacity={0.8}>
        <MaterialIcons name="add" size={16} color="#5D6967" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  sideSlot: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  value: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 16,
    lineHeight: 20,
    color: '#162018',
    textAlign: 'center',
  },
  placeholder: {
    color: '#98A2AB',
  },
  input: {
    width: '100%',
    fontFamily: 'Pretendard-Medium',
    fontSize: 16,
    color: '#162018',
    textAlign: 'center',
    paddingVertical: 14,
    includeFontPadding: false,
  },
  counterWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 132,
  },
  counterValue: {
    minWidth: 34,
    textAlign: 'center',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: '#40503F',
  },
  counterButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
