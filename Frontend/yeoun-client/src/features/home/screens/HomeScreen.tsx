import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


import { HomeSearchBar } from '../components/HomeSearchBar';
import { PastTravelSection } from '../components/PastTravelSection';
import { useTripStore } from '@/src/store/trip.store';

const baseImage = require('@/assets/images/base.png');

const HomeScreen = () => {
    const isTripActive = useTripStore((state) => state.isTripActive);
    const restoreActiveTripFromServer = useTripStore((state) => state.restoreActiveTripFromServer);

    useEffect(() => {
        void restoreActiveTripFromServer();
    }, [restoreActiveTripFromServer]);

    return (
        <View style={styles.container}>
            <View style={styles.heroBackground} pointerEvents="none">
                <Image
                    source={baseImage}
                    style={styles.heroImage}
                    contentFit="cover"
                />
                <View style={styles.heroOverlay} />
            </View>

            <SafeAreaView style={styles.safeArea}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={[styles.contentContainer, { paddingBottom: 80 }]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.searchSection}>
                        <HomeSearchBar />
                    </View>

                    <View style={styles.pastTravelSection}>
                        <PastTravelSection isTripActive={isTripActive} />
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

export default HomeScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F6F2',
    },
    heroBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '74%',
        overflow: 'hidden',
    },
    heroImage: {
        width: '114%',
        height: '114%',
        marginLeft: '-7%',
        marginTop: '-4%',
    },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    safeArea: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        flexGrow: 1,
    },
    searchSection: {
        minHeight: 320,
        justifyContent: 'flex-start',
        paddingTop: 16,
    },
    pastTravelSection: {
        width: '100%',
    },
});
