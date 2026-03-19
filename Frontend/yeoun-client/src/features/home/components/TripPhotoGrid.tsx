import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

interface TripPhotoGridProps {
    photos: any[];
}

export const TripPhotoGrid = ({ photos }: TripPhotoGridProps) => {
    if (!photos || photos.length === 0) {
        return (
            <View className="w-[115px] h-[134px] bg-[#C1CDC2] rounded-[24px] overflow-hidden">
                <Image
                    source={require('@/assets/images/base.png')}
                    className="w-full h-full"
                    contentFit="cover"
                />
            </View>
        );
    }

    if (photos.length === 1) {
        return (
            <View className="w-[115px] h-[134px] rounded-[24px] overflow-hidden">
                <Image
                    source={photos[0]}
                    className="w-full h-full"
                    contentFit="cover"
                />
            </View>
        );
    }

    // Grid layout for 2-4 photos
    return (
        <View className="w-[115px] h-[134px] bg-[#C1CDC2] rounded-[24px] overflow-hidden flex-row flex-wrap gap-1 p-1 items-center justify-center">
            {photos.slice(0, 4).map((photo, idx) => {
                // Determine item width/height based on count
                const count = Math.min(photos.length, 4);
                let itemClass = "rounded-[8px]";
                
                if (count === 2) {
                    itemClass += " w-[51px] h-[126px]";
                } else if (count === 3) {
                    if (idx === 0) {
                        itemClass += " w-[105px] h-[61px]";
                    } else {
                        itemClass += " w-[51px] h-[61px]";
                    }
                } else { // 4 photos
                    itemClass += " w-[51px] h-[61px]";
                }

                return (
                    <Image
                        key={idx}
                        source={photo}
                        className={itemClass}
                        contentFit="cover"
                    />
                );
            })}
        </View>
    );
};
