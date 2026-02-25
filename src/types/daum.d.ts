interface DaumPostcodeData {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  userSelectedType: "R" | "J";
  bname: string;
  buildingName: string;
  apartment: "Y" | "N";
  addressType: string;
}

interface DaumPostcodeOptions {
  oncomplete: (data: DaumPostcodeData) => void;
  width?: string | number;
  height?: string | number;
}

interface DaumPostcode {
  new (options: DaumPostcodeOptions): { open: () => void };
}

interface Daum {
  Postcode: DaumPostcode;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface LeafletMap {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  on: (type: string, handler: any) => LeafletMap;
  remove: () => void;
  fitBounds: (bounds: any, options?: any) => LeafletMap;
  invalidateSize: () => void;
}

interface LeafletMarker {
  setLatLng: (latlng: [number, number] | { lat: number; lng: number }) => LeafletMarker;
  getLatLng: () => { lat: number; lng: number };
  addTo: (map: LeafletMap) => LeafletMarker;
  on: (type: string, handler: any) => LeafletMarker;
  remove: () => void;
}

interface LeafletCircle {
  setLatLng: (latlng: [number, number]) => LeafletCircle;
  setRadius: (radius: number) => LeafletCircle;
  addTo: (map: LeafletMap) => LeafletCircle;
  remove: () => void;
}

interface LeafletPolyline {
  addTo: (map: LeafletMap) => LeafletPolyline;
  getBounds: () => any;
  remove: () => void;
}

interface LeafletStatic {
  map: (container: HTMLElement) => LeafletMap;
  tileLayer: (url: string, options?: any) => { addTo: (map: LeafletMap) => void };
  marker: (latlng: [number, number], options?: any) => LeafletMarker;
  circle: (latlng: [number, number], options?: any) => LeafletCircle;
  polyline: (latlngs: [number, number][], options?: any) => LeafletPolyline;
  latLngBounds: (latlngs: [number, number][]) => any;
}

interface Window {
  daum: Daum;
  L: LeafletStatic;
}
