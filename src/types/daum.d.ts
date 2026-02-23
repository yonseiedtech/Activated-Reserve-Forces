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
interface NaverMaps {
  LatLng: new (lat: number, lng: number) => any;
  LatLngBounds: new (sw: any, ne: any) => any;
  Map: new (container: HTMLElement, options: any) => any;
  Marker: new (options: any) => any;
  Polyline: new (options: any) => any;
  Event: {
    addListener: (target: any, type: string, handler: any) => void;
  };
  Point: new (x: number, y: number) => any;
  Size: new (w: number, h: number) => any;
}

interface Window {
  daum: Daum;
  naver: {
    maps: NaverMaps;
  };
}
