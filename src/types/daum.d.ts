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

interface Window {
  daum: Daum;
}
