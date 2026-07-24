/* Weekly Report — Rule Engine.
 * Toàn bộ luật sinh "Đánh giá nhân viên" (theo từng market) và "Phương án tuần tới"
 * nằm ở `src/shared/weeklyMetrics.ts` để DÙNG CHUNG với PDF → web và PDF ra CHỮ GIỐNG HỆT.
 * File này chỉ re-export cho tầng UI dùng. */
export {
  reviewEmployee,
  planForMarket,
  buildNarrative,
  allEmployeeNames,
} from '../../../src/shared/weeklyMetrics';
