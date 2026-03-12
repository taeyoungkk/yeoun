import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { ExpenseGraph } from '@/src/features/payment/components/ExpenseGraph';
import { ExpenseTable } from '@/src/features/payment/components/ExpenseTable';
import { useExpenseStore } from '@/src/store/expenseStore';
import { PillNav } from '@/src/components/ui/pill-navbar';
import { HouseSvg } from '@/src/components/icons/HouseSvg';
import { MapLocationPinSvg } from '@/src/components/icons/MapLocationPinSvg';
import { ProfileRoundSvg } from '@/src/components/icons/ProfileRoundSvg';
import { CreditCardSvg } from '@/src/components/icons/CreditCardSvg';
import { useColorScheme } from '@/src/hooks/use-color-scheme';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  runOnJS
} from 'react-native-reanimated';

// Define a separate component for DraggableAvatar to prevent hook issues
const DraggableAvatar = ({ 
  member, 
  draggingMemberId, 
  setDraggingMember, 
  updateHoverState, 
  handleFinalize, 
  setHoveredExpense,
  editingMemberId,
  setEditingMemberId,
  removeMember
}: { 
  member: any, 
  draggingMemberId: string | null,
  setDraggingMember: (id: string | null) => void,
  updateHoverState: (ax: number, ay: number) => void,
  handleFinalize: (ax: number, ay: number, memberId: string) => void,
  setHoveredExpense: (id: string | null) => void,
  editingMemberId: string | null,
  setEditingMemberId: (id: string | null) => void,
  removeMember: (id: string) => void
}) => {
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(100)
    .minPointers(1)
    .onStart(() => {
      runOnJS(setDraggingMember)(member.id);
    })
    .onUpdate((event) => {
      x.value = event.translationX;
      y.value = event.translationY;
      runOnJS(updateHoverState)(event.absoluteX, event.absoluteY);
    })
    .onEnd((event) => {
      runOnJS(handleFinalize)(event.absoluteX, event.absoluteY, member.id);
    })
    .onFinalize(() => {
      runOnJS(setDraggingMember)(null);
      runOnJS(setHoveredExpense)(null);
      x.value = withSpring(0);
      y.value = withSpring(0);
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(setEditingMemberId)(editingMemberId === member.id ? null : member.id);
  });

  const combinedGesture = Gesture.Simultaneous(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: draggingMemberId === member.id ? 1.3 : 1 }
    ],
    opacity: draggingMemberId === member.id ? 0.8 : 1,
    zIndex: draggingMemberId === member.id ? 10000 : 1,
    elevation: draggingMemberId === member.id ? 10000 : 0,
  }));

  return (
    <GestureDetector gesture={combinedGesture}>
      <Animated.View 
        style={[animatedStyle, { marginHorizontal: 2 }]}
        hitSlop={{ top: 15, bottom: 15, left: 10, right: 10 }}
      >
        <View className="relative">
          <View 
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: member.color,
              borderWidth: 1,
              borderColor: 'white'
            }}
          />
          
          {editingMemberId === member.id && (
            <TouchableOpacity 
              onPress={() => {
                 removeMember(member.id);
                 setEditingMemberId(null);
              }}
              className="absolute -top-3 -right-3 bg-red-500 rounded-full w-6 h-6 items-center justify-center border border-white z-[10001]"
            >
              <Ionicons name="remove" size={14} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

export default function PaymentDetailsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { 
    members, 
    removeMember, 
    setDraggingMember, 
    draggingMemberId,
    addMemberToExpense,
    setHoveredExpense,
    hoveredExpenseId,
    findDropTarget
  } = useExpenseStore();
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  // Define the JS functions to be called from the UI thread
  const updateHoverState = (ax: number, ay: number) => {
    const targetId = findDropTarget(ax, ay);
    if (targetId !== hoveredExpenseId) {
      setHoveredExpense(targetId);
    }
  };

  const handleFinalize = (ax: number, ay: number, memberId: string) => {
    const targetId = findDropTarget(ax, ay);
    if (targetId) {
      addMemberToExpense(targetId, memberId);
    }
  };

  const navItems = useMemo(() => [
    { 
      label: 'Home', 
      href: '/', 
      icon: ({ color, size }: { color: string; size: number }) => <HouseSvg color={color} size={size} />
    },
    { 
      label: 'Explore', 
      href: '/explore', 
      icon: ({ color, size }: { color: string; size: number }) => <MapLocationPinSvg color={color} size={size} />
    },
    { 
      label: 'Cards', 
      href: '/cards', 
      icon: ({ color, size }: { color: string; size: number }) => <CreditCardSvg color={color} size={size} />
    },
    { 
      label: 'My Page', 
      href: '/mypage', 
      icon: ({ color, size }: { color: string; size: number }) => <ProfileRoundSvg color={color} size={size} />
    },
  ], []);
  
  const bgColor = '#EBF3EA';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ScrollView 
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 20 }}
          scrollEnabled={!draggingMemberId}
        >
          
          <View className="mt-8 mb-6 flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="black" />
            </TouchableOpacity>
            <View>
              <Text className="text-black font-bold text-3xl mb-2" style={{ fontFamily: 'DM Sans' }}>현재 여행 지출</Text>
              <Text className="text-black font-bold text-xl tracking-tight" style={{ fontFamily: 'DM Sans' }}>총 지출: 145,000</Text>
            </View>
          </View>

          <View className="mb-10 px-2">
            <ExpenseGraph />
          </View>

          <View style={{ zIndex: 9999, elevation: 9999 }}>
            <View className="flex-row justify-between items-center px-1">
              <Text className="text-black font-bold text-xl" style={{ fontFamily: 'DM Sans' }}>지출 내역</Text>
              
              <View 
                className="flex-row items-center bg-gray-200/50 rounded-full px-3 py-2"
                style={{ overflow: 'visible' }}
              >
                <TouchableOpacity className="mr-2">
                  <Ionicons name="add" size={16} color="black" />
                </TouchableOpacity>
                
                <View className="flex-row" style={{ overflow: 'visible' }}>
                  {members.map(member => (
                    <DraggableAvatar 
                      key={member.id} 
                      member={member} 
                      draggingMemberId={draggingMemberId}
                      setDraggingMember={setDraggingMember}
                      updateHoverState={updateHoverState}
                      handleFinalize={handleFinalize}
                      setHoveredExpense={setHoveredExpense}
                      editingMemberId={editingMemberId}
                      setEditingMemberId={setEditingMemberId}
                      removeMember={removeMember}
                    />
                  ))}
                </View>
              </View>
            </View>
          </View>
        
          <View style={{ zIndex: 1, elevation: 1 }}>
            <ExpenseTable />
          </View>
        </ScrollView>
      </GestureHandlerRootView>

      <PillNav 
        items={navItems} 
        baseColor={colorScheme === 'dark' ? '#111' : '#fff'}
        pillColor={colorScheme === 'dark' ? '#fff' : '#000'}
        activeTextColor={colorScheme === 'dark' ? '#000' : '#fff'}
        inactiveTextColor={colorScheme === 'dark' ? '#999' : '#666'}
      />

    </SafeAreaView>
  );
}
