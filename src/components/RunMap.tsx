import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { radius, colors } from '../theme';
import type { RouteCoordinate } from '../navigation/types';

const DEFAULT_HEIGHT = 260;

type Props = {
  coordinates: RouteCoordinate[];
  /** Card height; defaults to 260. */
  height?: number;
};

export default function RunMap({ coordinates, height = DEFAULT_HEIGHT }: Props) {
  const mapRef = useRef<MapView | null>(null);

  if (coordinates.length === 0) {
    return (
      <View style={[styles.container, { height }, styles.emptyContainer]}>
        <Text style={styles.emptyText}>No route recorded</Text>
      </View>
    );
  }

  const firstCoordinate = coordinates[0];
  const initialRegion = {
    ...firstCoordinate,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const handleMapReady = () => {
    if (coordinates.length === 1) {
      mapRef.current?.animateToRegion(initialRegion, 0);
      return;
    }

    mapRef.current?.fitToCoordinates(coordinates, {
      edgePadding: { top: 36, right: 36, bottom: 36, left: 36 },
      animated: false,
    });
  };

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        onMapReady={handleMapReady}
        scrollEnabled={false}
        zoomEnabled={false}
        zoomTapEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        showsCompass={false}
        showsScale={false}
      >
        {coordinates.length > 1 && (
          <Polyline
            coordinates={coordinates}
            strokeColor={colors.statOrange}
            strokeWidth={4}
          />
        )}
        <Marker coordinate={firstCoordinate} title="Start">
          <View style={styles.startMarker} />
        </Marker>
        {coordinates.length > 1 && (
          <Marker coordinate={coordinates[coordinates.length - 1]} title="Finish">
            <View style={styles.endMarker} />
          </Marker>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: DEFAULT_HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceGray,
  },
  emptyText: {
    color: colors.textSecondary,
  },
  startMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.statGreen,
    borderWidth: 2,
    borderColor: colors.white,
  },
  endMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.statOrange,
    borderWidth: 2,
    borderColor: colors.white,
  },
});