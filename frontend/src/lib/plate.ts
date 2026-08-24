// 차량번호 형식 검사.
// 계근 등록에서 적은 번호는 차량 목록에도 쌓이는데, 적다 만 값(예: "8410")까지 들어가면
// 다음 사람이 그 값을 고르게 된다. 번호 꼴을 갖춘 것만 목록에 올린다.
//
// 허용하는 꼴 — 공백·하이픈은 무시한다.
//   12가3456      두세 자리 + 한글 한 자 + 네 자리
//   220하6978
//   경기85사3817   지역 두 자 + 위 형태 (구형 번호판)
const PLATE = /^(?:[가-힣]{2})?\d{2,3}[가-힣]\d{4}$/;

export function normalizePlate(value: string): string {
  return value.replace(/[\s-]/g, '');
}

export function isPlateNo(value: string): boolean {
  return PLATE.test(normalizePlate(value));
}
