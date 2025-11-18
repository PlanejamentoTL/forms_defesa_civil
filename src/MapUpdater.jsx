import { useEffect } from "react";
import { useMap } from "react-leaflet";

export default function MapUpdater({ lat, lng }) {
  const map = useMap();

  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], 18, { animate: true });
    }
  }, [lat, lng, map]);

  return null;
}
