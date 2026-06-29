/* Ads Monitor — trang chính (PHASE 2: UI đầy đủ với dữ liệu mock).
 * KHÔNG kết nối Google Sheet / Supabase / API. */
import { PageContainer, SectionHeader } from '../../../src/components/ui';
import { AdsSummaryCards } from '../components/AdsSummaryCards';
import { AdsFilters } from '../components/AdsFilters';
import { AdsTable } from '../components/AdsTable';
import { MOCK_ADS } from '../services/mockAds';

export function AdsMonitorPage() {
  return (
    <div className="text-fg">
      <PageContainer>
        {/* 1. Tiêu đề */}
        <SectionHeader title="📡 Ads Monitor"
          action={<span className="text-xs text-muted">Dữ liệu mẫu (mock) · chưa kết nối API</span>} />

        {/* 2. Thanh KPI */}
        <AdsSummaryCards />

        {/* 3. Bộ lọc + 4. Bảng dữ liệu */}
        <div className="mt-4">
          <AdsFilters />
          <AdsTable rows={MOCK_ADS} />
        </div>
      </PageContainer>
    </div>
  );
}
