import { StyleSheet, View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from 'expo-router';

import { ProfileHeader } from "@/src/components/profile/ProfileHeader";
import { UserInfoCard } from "@/src/components/profile/UserInfoCard";

const MOCK_USER_DATA = {
  email: 'qwerty@gmail.com',
  phone: '010-0000-0000',
  joinDate: '2026/03/09',
  friendsCount: 5,
};

export default function MyPageScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ProfileHeader 
          nickname="지우" 
          location="대한민국, 대전광역시" 
          onSettingsPress={() => router.push('/settings')}
        />
        
        <UserInfoCard data={MOCK_USER_DATA} />
        
        {/* Placeholder for Trip Lists */}
        
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F6EB', // Matching the earthy green from your design
  },
  scrollContent: {
    paddingBottom: 120, // Add padding for the Pill Navbar at bottom
  },
});
