import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getProfileImageUrl } from '@/src/utils/image-utils';
import { stringToColor } from '@/src/utils/colors';

export interface ProfileHeaderProps {
  nickname: string;
  location: string;
  avatarUrl?: string; // Optional image prop
  onSettingsPress?: () => void;
}

export function ProfileHeader({ 
  nickname, 
  location, 
  avatarUrl, 
  onSettingsPress 
}: ProfileHeaderProps) {
  // Use avatar URL if available, else derive color from nickname hash
  const bgColor = avatarUrl ? 'transparent' : stringToColor(nickname);
  // Show first character of nickname
  const initial = nickname ? nickname.charAt(0).toUpperCase() : '?';

  return (
    <View style={styles.container}>
      <View style={[styles.avatarContainer, { backgroundColor: bgColor }]}>
        {avatarUrl ? (
          <Image source={{ uri: getProfileImageUrl(avatarUrl) as string }} style={styles.avatarImage} contentFit="cover" />
        ) : (
          <Text style={styles.avatarText}>{initial}</Text>
        )}
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.nickname}>{nickname}</Text>
        <View style={styles.locationContainer}>
          <Ionicons name="location" size={16} color="#D97A59" />
          <Text style={styles.locationText}>{location}</Text>
        </View>
      </View>
      
      <Pressable 
        onPress={onSettingsPress} 
        style={({ pressed }) => [
          styles.settingsButton,
          { opacity: pressed ? 0.7 : 1 }
        ]}
      >
        <Ionicons name="settings-sharp" size={28} color="#222" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  avatarContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 16,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '500',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  nickname: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#D97A59', // Terracotta accent color
    marginLeft: 4,
    fontWeight: '500',
  },
  settingsButton: {
    padding: 8,
  },
});
