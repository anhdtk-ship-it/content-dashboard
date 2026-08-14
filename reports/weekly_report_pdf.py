#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Weekly Report — PDF cho Leader (reportlab.platypus).
Phong cách Business Dashboard / McKinsey / Power BI: A4 dọc, nhiều khoảng trắng,
tiêu đề nổi bật, KPI card cân đối, bảng rõ ràng, header đẹp, footer nhỏ, KHÔNG QR.
Bảng màu giới hạn: XANH (tốt) · VÀNG (cảnh báo) · ĐỎ (kém) · XÁM (trung tính).

Dữ liệu lấy từ reports/report.json — sinh bởi reports/build_weekly_data.ts, vốn dùng
CHUNG module src/shared/weeklyMetrics.ts với Dashboard Weekly Report
=> PDF và Dashboard KHÔNG THỂ lệch số liệu.

Bố cục:
  Trang 1: Header · I. Tổng quan Team (Nội địa, Quốc tế) · II. Tiến độ nhân viên (2 bảng)
  Trang 2: III. Đánh giá từng nhân viên · IV. Phương án tuần tới

Chạy:
  pip install reportlab
  npx ts-node reports/build_weekly_data.ts --from 2026-07-14 --to 2026-07-20 --out reports/report.json
  python reports/weekly_report_pdf.py --data reports/report.json --out reports/weekly_report.pdf

COMPONENT HOÁ (mỗi phần 1 hàm dựng flowable): Header · KPICard · EmployeeTable ·
EmployeeReview · ActionPlan.  KHÔNG dựng toàn bộ nội dung bằng canvas
(canvas chỉ dùng cho footer/số trang — đúng chuẩn platypus).
"""
import argparse
import json
import os
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (KeepTogether, PageBreak, Paragraph,
                                SimpleDocTemplate, Spacer, Table, TableStyle)

# ================= BẢNG MÀU (chỉ 4 tông) =================
XANH = colors.HexColor('#0F766E')   # tốt / thương hiệu
VANG = colors.HexColor('#D97706')   # cảnh báo
DO = colors.HexColor('#DC2626')     # kém
INK = colors.HexColor('#1F2933')    # chữ chính (xám đậm)
XAM = colors.HexColor('#6B7280')    # chữ phụ
XAM_LINE = colors.HexColor('#D8DEE6')
XAM_BG = colors.HexColor('#F3F5F7')
XAM_BG2 = colors.HexColor('#E7EBEF')

# Ngưỡng — ĐỒNG BỘ với src/shared/weeklyMetrics.ts
LOW_TEST_RATE = 0.70
GOOD_DUYTRI_RATE = 0.10
HIGH_TON = 3
HIGH_CHO_DANG_BAI = 3


# ================= FONT Unicode (tiếng Việt) =================
def register_fonts():
    regular = [r'C:\Windows\Fonts\segoeui.ttf', r'C:\Windows\Fonts\arial.ttf',
               '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/Library/Fonts/Arial.ttf']
    bold = [r'C:\Windows\Fonts\segoeuib.ttf', r'C:\Windows\Fonts\arialbd.ttf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']
    reg = next((p for p in regular if os.path.exists(p)), None)
    bld = next((p for p in bold if os.path.exists(p)), None)
    if reg:
        pdfmetrics.registerFont(TTFont('App', reg))
        pdfmetrics.registerFont(TTFont('App-Bold', bld or reg))
        return 'App', 'App-Bold'
    sys.stderr.write('⚠️  Không thấy TTF Unicode → Helvetica (tiếng Việt có thể lỗi dấu).\n')
    return 'Helvetica', 'Helvetica-Bold'


FONT, FONT_B = register_fonts()


def vnum(n):
    try:
        return f'{int(n):,}'.replace(',', '.')
    except Exception:
        return str(n)


def vpct(x):
    try:
        return f'{round(float(x) * 1000) / 10:g}%'
    except Exception:
        return '0%'


def S():
    ss = getSampleStyleSheet()
    d = {}
    d['title'] = ParagraphStyle('t', parent=ss['Normal'], fontName=FONT_B, fontSize=18, textColor=INK, leading=22)
    d['sub'] = ParagraphStyle('s', parent=ss['Normal'], fontName=FONT, fontSize=9, textColor=XAM, leading=12)
    d['subR'] = ParagraphStyle('sr', parent=d['sub'], alignment=TA_RIGHT)
    d['h1'] = ParagraphStyle('h1', parent=ss['Normal'], fontName=FONT_B, fontSize=12, textColor=colors.white, leading=15)
    d['h2'] = ParagraphStyle('h2', parent=ss['Normal'], fontName=FONT_B, fontSize=10.5, textColor=INK, leading=13)
    d['h3'] = ParagraphStyle('h3', parent=ss['Normal'], fontName=FONT_B, fontSize=9.5, textColor=XANH, leading=12)
    d['body'] = ParagraphStyle('b', parent=ss['Normal'], fontName=FONT, fontSize=9, textColor=INK, leading=12.5)
    d['cardnum'] = ParagraphStyle('cn', parent=ss['Normal'], fontName=FONT_B, fontSize=15, alignment=TA_CENTER, leading=17)
    d['cardlbl'] = ParagraphStyle('cl', parent=ss['Normal'], fontName=FONT, fontSize=7, textColor=XAM, alignment=TA_CENTER, leading=8.5)
    d['th'] = ParagraphStyle('th', parent=ss['Normal'], fontName=FONT_B, fontSize=8, textColor=INK, alignment=TA_CENTER, leading=10)
    d['thL'] = ParagraphStyle('thl', parent=d['th'], alignment=TA_LEFT)
    d['td'] = ParagraphStyle('td', parent=ss['Normal'], fontName=FONT, fontSize=8.6, textColor=INK, alignment=TA_CENTER, leading=11)
    d['tdL'] = ParagraphStyle('tdl', parent=ss['Normal'], fontName=FONT_B, fontSize=8.6, textColor=INK, alignment=TA_LEFT, leading=11)
    return d


# ================= COMPONENT: Header =================
def c_header(rep, st, width):
    left = Paragraph('BÁO CÁO CONTENT TUẦN', st['title'])
    right = Paragraph(f"Kỳ: <b>{rep['range']['label']}</b><br/>Ngày xuất: {rep.get('exportedAt', '')}", st['subR'])
    t = Table([[left, right]], colWidths=[width * 0.62, width * 0.38])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -1), 1.6, XANH),
    ]))
    return t


# ================= COMPONENT: Section bar =================
def c_section(title, st, width):
    t = Table([[Paragraph(title, st['h1'])]], colWidths=[width])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), XANH),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    return t


# ================= COMPONENT: KPI Card (7 thẻ / market) =================
def _tone_ton(v):
    return DO if v >= HIGH_TON * 2 else (VANG if v > 0 else XANH)


def _tone_cdb(v):
    return DO if v >= HIGH_CHO_DANG_BAI * 2 else (VANG if v > 0 else XANH)


def _tone_rate_test(v):
    return XANH if v >= LOW_TEST_RATE else (VANG if v >= LOW_TEST_RATE * 0.7 else DO)


def _tone_rate_dt(v):
    return XANH if v >= GOOD_DUYTRI_RATE else (VANG if v > 0 else DO)


def c_kpi_cards(kpi, st, width):
    items = [
        ('Đã cấp', vnum(kpi['capped']), INK),
        ('Đã test', vnum(kpi['tested']), INK),
        ('Tồn', vnum(kpi['ton']), _tone_ton(kpi['ton'])),
        ('Chờ đăng bài', vnum(kpi['choDangBai']), _tone_cdb(kpi['choDangBai'])),
        ('Tỷ lệ test', vpct(kpi['rateTest']), _tone_rate_test(kpi['rateTest'])),
        ('Content Duy trì', vnum(kpi['duyTriThang']), XANH),
        ('Tỷ lệ Duy trì', vpct(kpi['rateDuyTri']), _tone_rate_dt(kpi['rateDuyTri'])),
    ]
    row = []
    for label, val, tone in items:
        numst = ParagraphStyle('n', parent=st['cardnum'], textColor=tone)
        row.append([Paragraph(val, numst), Paragraph(label, st['cardlbl'])])
    cw = width / 7.0
    t = Table([row], colWidths=[cw] * 7, rowHeights=[1.35 * cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), XAM_BG),
        ('BOX', (0, 0), (-1, -1), 0.5, XAM_LINE),
        ('INNERGRID', (0, 0), (-1, -1), 3, colors.white),
        ('LINEABOVE', (0, 0), (-1, 0), 1.6, XANH),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t


# ================= COMPONENT: Employee Table =================
COLS = ['Nhân viên', 'Đã cấp', 'Đã test', 'Tồn', 'Chờ đăng bài', 'Tỷ lệ test', 'Duy trì tháng', 'Đang duy trì']


def _row_cells(k, st, bold=False):
    style = st['td'] if not bold else ParagraphStyle('tb', parent=st['td'], fontName=FONT_B)
    ton_st = ParagraphStyle('tn', parent=style, textColor=_tone_ton(k['ton']))
    cdb_st = ParagraphStyle('cdb', parent=style, textColor=_tone_cdb(k['choDangBai']))
    rt_st = ParagraphStyle('rt', parent=style, textColor=_tone_rate_test(k['rateTest']))
    dt_st = ParagraphStyle('dt', parent=style, textColor=XANH)
    return [
        Paragraph(vnum(k['capped']), style), Paragraph(vnum(k['tested']), style),
        Paragraph(vnum(k['ton']), ton_st), Paragraph(vnum(k['choDangBai']), cdb_st),
        Paragraph(vpct(k['rateTest']), rt_st),
        Paragraph(vnum(k['duyTriThang']), dt_st), Paragraph(vnum(k['dangDuyTri']), style),
    ]


def c_employee_table(block, st, width):
    data = [[Paragraph(COLS[0], st['thL'])] + [Paragraph(c, st['th']) for c in COLS[1:]]]
    for e in block['employees']:
        data.append([Paragraph(e['name'], st['tdL'])] + _row_cells(e['kpi'], st))
    data.append([Paragraph('TỔNG', st['tdL'])] + _row_cells(block['team'], st, bold=True))

    name_w = 3.0 * cm
    numw = (width - name_w) / 7.0
    t = Table(data, colWidths=[name_w] + [numw] * 7, repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), XAM_BG2),
        ('LINEBELOW', (0, 0), (-1, 0), 0.8, XAM_LINE),
        ('GRID', (0, 0), (-1, -1), 0.4, XAM_LINE),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('BACKGROUND', (0, -1), (-1, -1), XAM_BG2),
        ('LINEABOVE', (0, -1), (-1, -1), 0.9, XAM),
    ]
    for i in range(1, len(block['employees']) + 1):
        if i % 2 == 0:
            style.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#FAFBFC')))
    t.setStyle(TableStyle(style))
    return t


# ================= COMPONENT: Employee Review =================
def c_employee_review(name, blocks, narrative, st, width):
    flow = [Paragraph(name, st['h2']), Spacer(1, 2)]
    for b in blocks:
        if not any(e['name'] == name for e in b['employees']):
            continue
        items = [x for x in narrative.get('reviews', {}).get(f"{name}|{b['market']}", []) if str(x).strip()]
        if not items:
            continue
        flow.append(Paragraph(b['label'], st['h3']))
        for it in items:
            flow.append(Paragraph(it.replace('&', '&amp;'), st['body']))
        flow.append(Spacer(1, 3))
    flow.append(Spacer(1, 4))
    return KeepTogether(flow)


# ================= COMPONENT: Action Plan =================
def c_action_plan(block, narrative, st, width):
    items = [x for x in narrative.get('plans', {}).get(block['market'], []) if str(x).strip()]
    flow = [Paragraph(block['label'], st['h3']), Spacer(1, 2)]
    for it in items:
        flow.append(Paragraph(f"☐&nbsp;&nbsp;{it.replace('&', '&amp;')}", st['body']))
    flow.append(Spacer(1, 6))
    return KeepTogether(flow)


# ================= FOOTER (canvas — chỉ số trang) =================
def _footer(canv, doc):
    canv.saveState()
    canv.setStrokeColor(XAM_LINE)
    canv.setLineWidth(0.5)
    y = 1.05 * cm
    canv.line(doc.leftMargin, y + 10, doc.leftMargin + doc.width, y + 10)
    canv.setFont(FONT, 7.5)
    canv.setFillColor(XAM)
    canv.drawString(doc.leftMargin, y, 'Content Operations · Báo cáo nội bộ')
    canv.drawRightString(doc.leftMargin + doc.width, y, f'Trang {canv.getPageNumber()}')
    canv.restoreState()


# ================= BUILD =================
def build(rep, out_path):
    doc = SimpleDocTemplate(
        out_path, pagesize=A4,
        leftMargin=1.5 * cm, rightMargin=1.5 * cm, topMargin=1.3 * cm, bottomMargin=1.7 * cm,
        title='Báo cáo Content tuần', author='Content Operations Dashboard',
    )
    w = doc.width
    st = S()
    markets = rep['markets']
    narrative = rep.get('narrative', {})

    story = []
    # ---------- TRANG 1 ----------
    story.append(c_header(rep, st, w))
    story.append(Spacer(1, 12))

    story.append(c_section('I. TỔNG QUAN TEAM', st, w))
    story.append(Spacer(1, 8))
    for b in markets:
        story.append(KeepTogether([
            Paragraph(b['label'], st['h3']), Spacer(1, 3),
            c_kpi_cards(b['team'], st, w), Spacer(1, 10),
        ]))

    story.append(Spacer(1, 2))
    story.append(c_section('II. TIẾN ĐỘ NHÂN VIÊN', st, w))
    story.append(Spacer(1, 8))
    for i, b in enumerate(markets):
        story.append(KeepTogether([
            Paragraph(f"{chr(65 + i)}. {b['label']}", st['h3']), Spacer(1, 3),
            c_employee_table(b, st, w), Spacer(1, 10),
        ]))

    # ---------- TRANG 2 ----------
    story.append(PageBreak())
    story.append(c_section('III. ĐÁNH GIÁ NHÂN VIÊN', st, w))
    story.append(Spacer(1, 8))
    names = []
    for b in markets:
        for e in b['employees']:
            if e['name'] not in names:
                names.append(e['name'])
    for n in names:
        story.append(c_employee_review(n, markets, narrative, st, w))

    story.append(Spacer(1, 6))
    story.append(c_section('IV. PHƯƠNG ÁN TUẦN TỚI', st, w))
    story.append(Spacer(1, 8))
    for b in markets:
        story.append(c_action_plan(b, narrative, st, w))

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    print(f'✅ Đã tạo PDF: {out_path}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default='reports/report.json')
    ap.add_argument('--out', default='reports/weekly_report.pdf')
    a = ap.parse_args()
    with open(a.data, 'r', encoding='utf-8') as f:
        rep = json.load(f)
    build(rep, a.out)


if __name__ == '__main__':
    main()
