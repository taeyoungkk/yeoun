import React from 'react';
import { View, Text, Pressable, StyleSheet, Image, Platform, ImageSourcePropType } from 'react-native';
import { Link, usePathname } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

export type PillNavItem = {
  label: string;
  href: string;
  iconSource?: ImageSourcePropType;
  icon?: (props: { color: string; size: number }) => React.ReactNode;
};

export interface PillNavProps {
  logo?: any;
  items: PillNavItem[];
  baseColor?: string;
  pillColor?: string;
  activeTextColor?: string;
  inactiveTextColor?: string;
}

const NavItem = ({ 
  item, 
  isActive, 
  pillColor, 
  activeTextColor, 
  inactiveTextColor 
}: { 
  item: PillNavItem, 
  isActive: boolean, 
  pillColor: string, 
  activeTextColor: string, 
  inactiveTextColor: string 
}) => {
  const isPressed = useSharedValue(0);

  const animatedInnerStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: isActive ? pillColor : 'transparent',
      transform: [{ scale: withSpring(isPressed.value ? 0.95 : 1) }]
    };
  });

  const textStyle = useAnimatedStyle(() => {
    return {
      color: isActive ? activeTextColor : inactiveTextColor
    };
  });

  const iconColor = isActive ? activeTextColor : inactiveTextColor;

  return (
    <Link href={item.href as any} asChild>
      <Pressable
        onPressIn={() => (isPressed.value = 1)}
        onPressOut={() => (isPressed.value = 0)}
      >
        <Animated.View style={[styles.pill, animatedInnerStyle]}>
          {item.icon ? (
            item.icon({ color: iconColor, size: 24 })
          ) : item.iconSource ? (
            <Image 
              source={item.iconSource} 
              style={{ width: 24, height: 24, tintColor: iconColor }} 
              resizeMode="contain"
            />
          ) : (
            <Animated.Text style={[styles.pillText, textStyle]}>
              {item.label}
            </Animated.Text>
          )}
        </Animated.View>
      </Pressable>
    </Link>
  );
};

export function PillNav({
  logo,
  items,
  baseColor = '#000',
  pillColor = '#fff',
  activeTextColor = '#000',
  inactiveTextColor = '#fff'
}: PillNavProps) {
  const pathname = usePathname();

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={[styles.navBar, { backgroundColor: baseColor }]}>
        {logo && (
          <Link href="/" asChild>
            <Pressable style={styles.logoContainer}>
              <Image source={logo} style={styles.logo} resizeMode="cover" />
            </Pressable>
          </Link>
        )}
        
        <View style={styles.itemsContainer}>
          {items.map((item) => (
            <NavItem 
              key={item.href}
              item={item}
              isActive={pathname === item.href}
              pillColor={pillColor}
              activeTextColor={activeTextColor}
              inactiveTextColor={inactiveTextColor}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20, // Bottom Safe area approximation
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  logoContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
    marginRight: 4,
  },
  logo: {
    width: 36,
    height: 36,
  },
  itemsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillText: {
    fontWeight: '600',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }
});
