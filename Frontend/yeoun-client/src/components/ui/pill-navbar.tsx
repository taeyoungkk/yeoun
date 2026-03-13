import React, { useMemo } from 'react';
import { View, Pressable, StyleSheet, Image, Platform, ImageSourcePropType } from 'react-native';
import { Link, usePathname } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useDerivedValue,
  withTiming,
  interpolateColor,
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
  
  // Use a derived value to track the active state as a number (0 or 1)
  const activeValue = useDerivedValue(() => {
    return withTiming(isActive ? 1 : 0, { duration: 250 });
  });

  const animatedInnerStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        activeValue.value,
        [0, 1],
        ['transparent', pillColor]
      ),
      transform: [{ scale: withSpring(isPressed.value ? 0.92 : 1) }]
    };
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      color: interpolateColor(
        activeValue.value,
        [0, 1],
        [inactiveTextColor, activeTextColor]
      )
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
            <Animated.Text style={[styles.pillText, animatedTextStyle]}>
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
  baseColor = '#fff',
  pillColor = '#000',
  activeTextColor = '#fff',
  inactiveTextColor = '#666'
}: PillNavProps) {
  const pathname = usePathname();

  const isTabActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === '/index';
    const normalizedPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    const normalizedHref = href.endsWith('/') ? href.slice(0, -1) : href;
    return normalizedPath === normalizedHref;
  };

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
              isActive={isTabActive(item.href)}
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
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    width: '100%',
    alignItems: 'center',
    position: 'absolute', // Ensure it floats above
    bottom: 0,
    zIndex: 1000,
    backgroundColor: 'transparent', // Added explicit transparency
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
    elevation: 10,
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
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }
});
