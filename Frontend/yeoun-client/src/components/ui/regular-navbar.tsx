import React from 'react';
import { View, Pressable, Platform } from 'react-native';
import { Link, usePathname } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  useDerivedValue,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type NavItem = {
  label: string;
  href: string;
  icon: (props: { color: string; size: number }) => React.ReactNode;
  showBadge?: boolean;
};

export interface RegularNavProps {
  items: NavItem[];
  backgroundColor?: string;
  activeColor?: string;
  inactiveColor?: string;
}

const TabItem = ({ 
  item, 
  isActive, 
  activeColor, 
  inactiveColor 
}: { 
  item: NavItem, 
  isActive: boolean, 
  activeColor: string, 
  inactiveColor: string 
}) => {
  const isPressed = useSharedValue(0);
  const activeValue = useDerivedValue(() => {
    return withTiming(isActive ? 1 : 0, { duration: 200 });
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withSpring(isPressed.value ? 0.9 : 1) }]
    };
  });

  const iconColor = isActive ? activeColor : inactiveColor;

  return (
    <Link href={item.href as any} asChild>
      <Pressable
        className="flex-1 items-center justify-center py-2"
        onPressIn={() => (isPressed.value = 1)}
        onPressOut={() => (isPressed.value = 0)}
      >
        <Animated.View style={animatedStyle} className="relative">
          {item.icon({ color: iconColor, size: 26 })}
          {item.showBadge && (
            <View className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
          )}
        </Animated.View>
      </Pressable>
    </Link>
  );
};

export function RegularNav({
  items,
  backgroundColor = '#fff',
  activeColor = '#244934',
  inactiveColor = '#94A098'
}: RegularNavProps) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  /** 현재 활성화된 탭인지 확인하는 함수 */
  const isTabActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === '/index';
    const normalizedPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    const normalizedHref = href.endsWith('/') ? href.slice(0, -1) : href;
    return normalizedPath === normalizedHref;
  };

  return (
    <View 
      className="absolute bottom-0 w-full border-t border-gray-100"
      style={{ 
        backgroundColor, 
        /** 기기별 하단 안전영역(Safe Area)을 고려하여 패딩을 설정합니다 */
        paddingBottom: Math.max(insets.bottom, 16),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 10,
      }}
    >
      <View className="flex-row justify-around items-center px-2 pt-2">
        {items.map((item) => (
          <TabItem 
            key={item.href}
            item={item}
            isActive={isTabActive(item.href)}
            activeColor={activeColor}
            inactiveColor={inactiveColor}
          />
        ))}
      </View>
    </View>
  );
}
